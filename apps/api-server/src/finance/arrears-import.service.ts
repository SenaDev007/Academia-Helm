/**
 * ============================================================================
 * ARREARS IMPORT SERVICE — Import en masse d'arriérés via Excel
 * ============================================================================
 *
 * Permet aux établissements d'importer les arriérés des élèves sur une ou
 * plusieurs années scolaires, depuis un fichier Excel (.xlsx).
 *
 * Un élève peut avoir des arriérés sur plusieurs années (ex: 2023-2024 +
 * 2024-2025). Le fichier contient une ligne par (élève × année scolaire).
 *
 * Workflow :
 *   1. L'admin télécharge le template Excel (GET /finance/arrears-import/template)
 *   2. L'admin remplit le template (une ligne par élève × année)
 *   3. L'admin upload le fichier → preview (POST /finance/arrears-import/preview)
 *   4. L'admin confirme → import (POST /finance/arrears-import/run)
 *      → crée un FeeArrear pour chaque ligne valide
 *      → met à jour le StudentAccount (arrearsAmount + totalDue + balance)
 *
 * Format Excel (7 colonnes) :
 *   Prénom | Nom | Matricule (optionnel) | Année scolaire | Montant total dû (FCFA) |
 *   Montant déjà payé (FCFA) | Notes (optionnel)
 *
 * Utilise ExcelJS (déjà installé côté backend).
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export interface ArrearsImportRow {
  rowIndex: number;
  firstName: string;
  lastName: string;
  matricule: string | null;
  academicYearLabel: string;
  totalDue: number;
  totalPaid: number;
  notes: string | null;
  // Validation
  errors: string[];
  isValid: boolean;
  // Résolution
  resolvedStudentId?: string;
  resolvedAcademicYearId?: string;
}

export interface ArrearsImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ArrearsImportRow[];
  summary: {
    totalArrearsAmount: number;
    byYear: Record<string, number>;
    studentsAffected: number;
  };
}

export interface ArrearsImportRunResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  results: Array<{
    rowIndex: number;
    studentName: string;
    academicYear: string;
    success: boolean;
    error?: string;
  }>;
}

@Injectable()
export class ArrearsImportService {
  private readonly logger = new Logger(ArrearsImportService.name);

  private static readonly HEADERS = [
    'Prénom',
    'Nom',
    'Matricule (optionnel)',
    'Année scolaire',
    'Montant total dû (FCFA)',
    'Montant déjà payé (FCFA)',
    'Notes (optionnel)',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse et valide le fichier Excel sans créer d'arriérés.
   */
  async previewImport(
    tenantId: string,
    fileDataUrl: string,
  ): Promise<ArrearsImportPreviewResult> {
    const workbook = await this.parseExcelFile(fileDataUrl);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Aucune feuille trouvée dans le fichier Excel');
    }

    // Pré-charger les élèves et années scolaires du tenant
    const students = await this.prisma.student.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true },
    });
    const academicYears = await this.prisma.academicYear.findMany({
      where: { tenantId },
      select: { id: true, name: true, label: true },
    });

    const rows: ArrearsImportRow[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const firstCell = row.getCell(1).value;
      if (!firstCell || (typeof firstCell === 'string' && !firstCell.trim())) return;

      const parsed = this.parseRow(row, rowNumber);
      this.validateRow(parsed, students, academicYears);
      rows.push(parsed);
    });

    const validRows = rows.filter((r) => r.isValid).length;
    const invalidRows = rows.length - validRows;

    // Statistiques
    const summary = {
      totalArrearsAmount: rows
        .filter((r) => r.isValid)
        .reduce((sum, r) => sum + (r.totalDue - r.totalPaid), 0),
      byYear: {} as Record<string, number>,
      studentsAffected: new Set(
        rows.filter((r) => r.isValid).map((r) => r.resolvedStudentId),
      ).size,
    };
    rows.filter((r) => r.isValid).forEach((r) => {
      summary.byYear[r.academicYearLabel] = (summary.byYear[r.academicYearLabel] || 0) + (r.totalDue - r.totalPaid);
    });

    return { totalRows: rows.length, validRows, invalidRows, rows, summary };
  }

  /**
   * Importe réellement les arriérés.
   */
  async runImport(
    tenantId: string,
    fileDataUrl: string,
  ): Promise<ArrearsImportRunResult> {
    const preview = await this.previewImport(tenantId, fileDataUrl);
    const validRows = preview.rows.filter((r) => r.isValid);

    const results: ArrearsImportRunResult['results'] = [];

    for (const row of validRows) {
      try {
        const balanceDue = row.totalDue - row.totalPaid;

        // Vérifier si un FeeArrear existe déjà pour cet élève + année
        const existing = await this.prisma.feeArrear.findFirst({
          where: {
            tenantId,
            studentId: row.resolvedStudentId!,
            academicYearId: row.resolvedAcademicYearId!,
          },
        });

        if (existing) {
          // Mettre à jour l'arriéré existant
          await this.prisma.feeArrear.update({
            where: { id: existing.id },
            data: {
              totalDue: row.totalDue,
              totalPaid: row.totalPaid,
              balanceDue,
              notes: row.notes || existing.notes,
              status: balanceDue <= 0 ? 'PAID' : (row.totalPaid > 0 ? 'PARTIALLY_PAID' : 'OPEN'),
            },
          });
        } else {
          // Créer un nouveau FeeArrear
          await this.prisma.feeArrear.create({
            data: {
              tenantId,
              studentId: row.resolvedStudentId!,
              academicYearId: row.resolvedAcademicYearId!,
              totalDue: row.totalDue,
              totalPaid: row.totalPaid,
              balanceDue,
              arrearsLevel: balanceDue > 100000 ? 'HIGH' : (balanceDue > 50000 ? 'MEDIUM' : 'LOW'),
              status: balanceDue <= 0 ? 'PAID' : (row.totalPaid > 0 ? 'PARTIALLY_PAID' : 'OPEN'),
              notes: row.notes,
            },
          });
        }

        // Mettre à jour le StudentAccount (arrearsAmount + totalDue + balance)
        // pour l'année active
        const activeYear = await this.prisma.academicYear.findFirst({
          where: { tenantId, isActive: true },
          select: { id: true },
        });
        if (activeYear) {
          const account = await this.prisma.studentAccount.findFirst({
            where: {
              tenantId,
              studentId: row.resolvedStudentId!,
              academicYearId: activeYear.id,
            },
          });
          if (account) {
            // Désactiver le trigger pour permettre la mise à jour directe
            await this.prisma.$executeRawUnsafe(`SET LOCAL app.allow_balance_update = 'true'`);
            await this.prisma.studentAccount.update({
              where: { id: account.id },
              data: {
                arrearsAmount: { increment: balanceDue },
                totalDue: { increment: balanceDue },
                balance: { increment: balanceDue },
              },
            });
          }
        }

        results.push({
          rowIndex: row.rowIndex,
          studentName: `${row.lastName} ${row.firstName}`,
          academicYear: row.academicYearLabel,
          success: true,
        });
      } catch (e) {
        this.logger.error(`Import arriéré ligne ${row.rowIndex}: ${e.message}`);
        results.push({
          rowIndex: row.rowIndex,
          studentName: `${row.lastName} ${row.firstName}`,
          academicYear: row.academicYearLabel,
          success: false,
          error: e.message,
        });
      }
    }

    return {
      totalRows: preview.totalRows,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Génère et télécharge le template Excel.
   */
  async downloadTemplate(res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Arriérés');

    worksheet.columns = ArrearsImportService.HEADERS.map((header) => ({
      header,
      key: header,
      width: 25,
    }));

    // Style en-tête
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92400E' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Exemples
    const examples = [
      ['Marie', 'AKOVI', 'ELV-001', '2023-2024', 75000, 30000, 'Scolarité 3e trimestre impayée'],
      ['Jean', 'DOSSOU', 'ELV-002', '2024-2025', 120000, 0, 'Scolarité année complète impayée'],
      ['Marie', 'AKOVI', 'ELV-001', '2024-2025', 50000, 25000, 'Frais de cantine impayés'],
    ];
    examples.forEach((ex) => worksheet.addRow(ex));

    for (let i = 2; i <= 4; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
    }

    // Notes
    worksheet.addRow([]);
    worksheet.addRow(['⚠️ Lignes d\'exemple à supprimer avant import.']);
    worksheet.addRow(['📅 Année scolaire : label exact (ex: 2023-2024, 2024-2025) — doit exister dans votre établissement.']);
    worksheet.addRow(['💰 Montant total dû : montant total des frais de l\'année (en FCFA).']);
    worksheet.addRow(['✅ Montant déjà payé : ce que l\'élève a déjà payé pour cette année (en FCFA).']);
    worksheet.addRow(['📊 Solde restant = Montant total dû − Montant déjà payé.']);
    worksheet.addRow(['🧑‍🎓 Matricule : optionnel mais recommandé pour identifier précisément l\'élève.']);
    worksheet.addColumn(['📋 Un élève peut avoir plusieurs lignes (une par année scolaire).']);
    worksheet.addRow(['📋 Colonnes obligatoires : Prénom, Nom, Année scolaire, Montant total dû, Montant déjà payé.']);

    for (let i = 5; i <= 13; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-arrieres-academia-helm.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Méthodes privées ───

  private async parseExcelFile(fileDataUrl: string): Promise<ExcelJS.Workbook> {
    const base64Match = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64Data = base64Match ? base64Match[2] : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  }

  private parseRow(row: ExcelJS.Row, rowNumber: number): ArrearsImportRow {
    const getCell = (col: number): string => {
      const val = row.getCell(col).value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object' && 'text' in val) return String((val as any).text || '').trim();
      if (typeof val === 'object' && 'result' in val) return String((val as any).result || '').trim();
      return String(val).trim();
    };

    const parseAmount = (s: string): number => {
      const cleaned = s.replace(/[^\d.-]/g, '');
      return cleaned ? Number(cleaned) : 0;
    };

    return {
      rowIndex: rowNumber,
      firstName: getCell(1),
      lastName: getCell(2),
      matricule: getCell(3) || null,
      academicYearLabel: getCell(4),
      totalDue: parseAmount(getCell(5)),
      totalPaid: parseAmount(getCell(6)),
      notes: getCell(7) || null,
      errors: [],
      isValid: true,
    };
  }

  private validateRow(
    row: ArrearsImportRow,
    students: any[],
    academicYears: any[],
  ): void {
    if (!row.firstName) row.errors.push('Prénom manquant');
    if (!row.lastName) row.errors.push('Nom manquant');
    if (!row.academicYearLabel) {
      row.errors.push('Année scolaire manquante');
    } else {
      const year = academicYears.find(
        (y) =>
          y.label?.toLowerCase() === row.academicYearLabel.toLowerCase() ||
          y.name?.toLowerCase() === row.academicYearLabel.toLowerCase(),
      );
      if (!year) {
        row.errors.push(
          `Année scolaire "${row.academicYearLabel}" introuvable. Années disponibles: ${academicYears.map((y) => y.label || y.name).join(', ')}`,
        );
      } else {
        row.resolvedAcademicYearId = year.id;
      }
    }

    // Résoudre l'élève (par matricule d'abord, puis par nom)
    if (row.matricule) {
      const student = students.find(
        (s) =>
          s.matricule?.toLowerCase() === row.matricule!.toLowerCase() ||
          s.studentCode?.toLowerCase() === row.matricule!.toLowerCase(),
      );
      if (student) {
        row.resolvedStudentId = student.id;
      }
    }
    if (!row.resolvedStudentId && row.firstName && row.lastName) {
      const student = students.find(
        (s) =>
          s.firstName?.toLowerCase() === row.firstName.toLowerCase() &&
          s.lastName?.toLowerCase() === row.lastName.toLowerCase(),
      );
      if (student) {
        row.resolvedStudentId = student.id;
      }
    }
    if (!row.resolvedStudentId) {
      row.errors.push(
        `Élève "${row.lastName} ${row.firstName}" introuvable${row.matricule ? ` (matricule: ${row.matricule})` : ''}. Vérifiez le nom exact ou utilisez le matricule.`,
      );
    }

    if (row.totalDue < 0) row.errors.push('Montant total dû ne peut pas être négatif');
    if (row.totalPaid < 0) row.errors.push('Montant déjà payé ne peut pas être négatif');
    if (row.totalPaid > row.totalDue) {
      row.errors.push('Montant déjà payé supérieur au montant total dû');
    }

    row.isValid = row.errors.length === 0;
  }
}
