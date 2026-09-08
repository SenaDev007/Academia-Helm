/**
 * ============================================================================
 * ARREARS IMPORT SERVICE — Import en masse d'arriérés via Excel (multi-feuilles)
 * ============================================================================
 *
 * ⭐ TEMPLATE MULTI-FEUILLES (une feuille par classe physique) :
 *   Le template généré contient une feuille par classe configurée dans le
 *   système. Chaque feuille est nommée d'après la classe (ex: "Maternelle 1",
 *   "CP", "6ème"). Chaque feuille est pré-remplie avec les élèves déjà
 *   inscrits dans cette classe (prénom, nom, matricule) — l'école n'a qu'à
 *   saisir les montants dus/payés et l'année scolaire.
 *
 * Workflow :
 *   1. L'admin télécharge le template (GET /finance/arrears-import/template)
 *      → une feuille par classe, pré-remplie avec les élèves
 *   2. L'admin remplit les montants pour chaque élève × année scolaire
 *   3. L'admin upload le fichier → preview (POST /finance/arrears-import/preview)
 *   4. L'admin confirme → import (POST /finance/arrears-import/run)
 *
 * Format Excel (7 colonnes par feuille) :
 *   Prénom | Nom | Matricule | Année scolaire | Montant total dû (FCFA) |
 *   Montant déjà payé (FCFA) | Notes (optionnel)
 *
 * ⚠️ Le prénom, nom et matricule sont pré-remplis pour les élèves existants.
 * L'école peut aussi ajouter manuellement des lignes pour de nouveaux élèves.
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export interface ArrearsImportRow {
  rowIndex: number;
  sheetName: string; // ⭐ nom de la feuille (utile pour le debug)
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
  sheetsProcessed: string[];
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
    sheetName: string;
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
    'Matricule',
    'Année scolaire',
    'Montant total dû (FCFA)',
    'Montant déjà payé (FCFA)',
    'Notes (optionnel)',
  ];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse et valide le fichier Excel (multi-feuilles) sans créer d'arriérés.
   */
  async previewImport(
    tenantId: string,
    fileDataUrl: string,
  ): Promise<ArrearsImportPreviewResult> {
    const workbook = await this.parseExcelFile(fileDataUrl);

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
    const sheetsProcessed: string[] = [];

    // ⭐ Itérer sur toutes les feuilles du classeur
    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      // Ignorer les feuilles d'instructions
      if (sheetName.startsWith('_') || /instruction/i.test(sheetName)) {
        return;
      }
      sheetsProcessed.push(sheetName);

      let isFirstRow = true;
      worksheet.eachRow((row, rowNumber) => {
        if (isFirstRow) {
          isFirstRow = false;
          return;
        }
        const firstCell = row.getCell(1).value;
        if (!firstCell || (typeof firstCell === 'string' && !firstCell.trim())) return;
        // Skip les lignes d'instructions (emoji)
        if (typeof firstCell === 'string' && /^[⚠️📅💰✅📊🧑📋💡🏫]/.test(firstCell.trim())) {
          return;
        }

        const parsed = this.parseRow(row, rowNumber, sheetName);
        this.validateRow(parsed, students, academicYears);
        rows.push(parsed);
      });
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

    return { totalRows: rows.length, validRows, invalidRows, rows, sheetsProcessed, summary };
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
          sheetName: row.sheetName,
          studentName: `${row.lastName} ${row.firstName}`,
          academicYear: row.academicYearLabel,
          success: true,
        });
      } catch (e) {
        this.logger.error(`Import arriéré feuille "${row.sheetName}" ligne ${row.rowIndex}: ${e.message}`);
        results.push({
          rowIndex: row.rowIndex,
          sheetName: row.sheetName,
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
   * ⭐ Génère et télécharge le template Excel MULTI-FEUILLES.
   * Une feuille par classe physique configurée dans le système (tenant).
   * Chaque feuille est pré-remplie avec les élèves déjà inscrits dans cette classe.
   */
  async downloadTemplate(tenantId: string, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    // ⭐ FIX 500 : récupérer les classes de l'ANNÉE ACTIVE uniquement (fallback :
    // la plus récente). Sans ce filtre, les classes des années antérieures (mêmes
    // noms — ex: « CI A » ×2) créent des feuilles Excel en double et ExcelJS jette
    // « Worksheet name already exists » → erreur 500 au téléchargement du template.
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { tenantId, isActive: true },
      orderBy: { name: 'desc' },
      select: { id: true },
    });
    const latestYear = activeYear
      ?? await this.prisma.academicYear.findFirst({
        where: { tenantId },
        orderBy: { name: 'desc' },
        select: { id: true },
      });

    // ⭐ Récupérer toutes les classes physiques du tenant, triées par niveau puis par nom
    const classes = await this.prisma.class.findMany({
      where: { tenantId, ...(latestYear ? { academicYearId: latestYear.id } : {}) },
      include: {
        schoolLevel: {
          select: { id: true, name: true, code: true, order: true },
        },
      },
      orderBy: [
        { schoolLevel: { order: 'asc' } },
        { name: 'asc' },
      ],
    });

    // ⭐ Récupérer toutes les années scolaires du tenant (pour l'exemple)
    const academicYears = await this.prisma.academicYear.findMany({
      where: { tenantId },
      select: { id: true, name: true, label: true },
      orderBy: { name: 'desc' },
    });
    const exampleYear = academicYears[0]?.name || '2024-2025';

    if (classes.length === 0) {
      // Fallback : template par défaut avec une seule feuille
      this.logger.warn(`Aucune classe configurée pour le tenant ${tenantId} — template par défaut`);
      const ws = workbook.addWorksheet('Arriérés');
      this.applySheetLayout(ws, '', exampleYear, []);
      this.addInstructionsRow(ws);
    } else {
      // ⭐ Récupérer les inscriptions actives par classe (avec les élèves)
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          classId: { in: classes.map(c => c.id) },
          status: { in: ['ENROLLED', 'PRE_REGISTERED'] },
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true },
          },
        },
        orderBy: { student: { lastName: 'asc' } },
      });

      // Grouper les élèves par classId
      const studentsByClass = new Map<string, any[]>();
      enrollments.forEach(e => {
        if (!e.classId) return;
        if (!studentsByClass.has(e.classId)) studentsByClass.set(e.classId, []);
        studentsByClass.get(e.classId)!.push(e.student);
      });

      // ⭐ Une feuille par classe — déduplication défensive des noms de feuilles
      const usedSheetNames = new Set<string>();
      for (const cls of classes) {
        let sheetName = this.sanitizeSheetName(cls.name || cls.code || `Classe-${cls.id.substring(0, 8)}`);
        if (usedSheetNames.has(sheetName)) {
          let suffix = 2;
          let candidate = sheetName;
          while (usedSheetNames.has(candidate)) {
            candidate = `${sheetName.substring(0, 28)}-${suffix}`;
            suffix++;
          }
          sheetName = candidate;
        }
        usedSheetNames.add(sheetName);
        const schoolLevelName = cls.schoolLevel?.name || '';
        const studentsInClass = studentsByClass.get(cls.id) || [];
        const ws = workbook.addWorksheet(sheetName);
        this.applySheetLayout(ws, schoolLevelName, exampleYear, studentsInClass);
        this.addInstructionsRow(ws);
        this.logger.log(`Feuille "${sheetName}" créée avec ${studentsInClass.length} élève(s) pré-rempli(s)`);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-arrieres-academia-helm.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Méthodes privées ───

  /**
   * Nettoie un nom de feuille Excel (max 31 chars, pas de \ / ? * [ ] :).
   */
  private sanitizeSheetName(name: string): string {
    let clean = name.replace(/[\\/?*\[\]:]/g, '-').trim();
    if (clean.length > 31) clean = clean.substring(0, 31);
    return clean || 'Feuille';
  }

  /**
   * Applique la mise en page standard à une feuille : en-têtes + élèves pré-remplis + bordures.
   */
  private applySheetLayout(
    worksheet: ExcelJS.Worksheet,
    schoolLevelName: string,
    exampleYear: string,
    studentsInClass: any[],
  ): void {
    // Définir les colonnes avec largeurs
    worksheet.columns = ArrearsImportService.HEADERS.map((header) => ({
      header,
      key: header,
      width: 22,
    }));

    // Style en-tête (ligne 1) — orange (couleur arriérés finance)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92400E' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // ⭐ Pré-remplir avec les élèves de la classe (une ligne par élève)
    // L'année scolaire est pré-remplie avec l'année d'exemple (modifiable)
    let rowIdx = 2;
    if (studentsInClass.length > 0) {
      for (const s of studentsInClass) {
        worksheet.addRow([
          s.firstName || '',
          s.lastName || '',
          s.matricule || s.studentCode || '',
          exampleYear, // pré-rempli mais modifiable
          '', // Montant dû — à remplir
          '', // Montant payé — à remplir
          '', // Notes — optionnel
        ]);
        rowIdx++;
      }
    } else {
      // Aucun élève dans cette classe — ligne d'exemple
      worksheet.addRow(['Marie', 'AKOVI', 'ELV-001', exampleYear, 75000, 30000, 'Scolarité impayée']);
      rowIdx++;
    }

    // Style des lignes de données (italique gris si exemples, normal si élèves réels)
    const startRow = 2;
    const endRow = rowIdx - 1;
    for (let i = startRow; i <= endRow; i++) {
      const row = worksheet.getRow(i);
      row.font = studentsInClass.length > 0
        ? { size: 10, color: { argb: 'FF1F2937' } }
        : { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
      row.alignment = { vertical: 'middle' };
    }

    // Bordures sur les colonnes (en-tête + lignes de données)
    for (let i = 1; i <= endRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      });
    }

    // ⭐ Note en haut de feuille indiquant la classe concernée
    const noteRow = worksheet.addRow([
      `🏫 Feuille pour la classe : ${worksheet.name}${schoolLevelName ? ` (${schoolLevelName})` : ''} — ` +
      `${studentsInClass.length} élève(s) pré-rempli(s). Saisissez les montants et l'année scolaire concernée.`,
    ]);
    noteRow.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
  }

  /**
   * Ajoute les lignes d'instructions en bas de feuille.
   */
  private addInstructionsRow(worksheet: ExcelJS.Worksheet): void {
    worksheet.addRow([]);
    worksheet.addRow(['⚠️ Lignes d\'exemple à supprimer avant import. Les lignes pré-remplies avec des élèves réels peuvent être conservées.']);
    worksheet.addRow(['📅 Année scolaire : label exact (ex: 2023-2024, 2024-2025) — doit exister dans votre établissement.']);
    worksheet.addRow(['💰 Montant total dû : montant total des frais de l\'année (en FCFA).']);
    worksheet.addRow(['✅ Montant déjà payé : ce que l\'élève a déjà payé pour cette année (en FCFA).']);
    worksheet.addRow(['📊 Solde restant = Montant total dû − Montant déjà payé.']);
    worksheet.addRow(['🧑‍🎓 Matricule : pré-rempli pour les élèves existants. Pour un nouvel élève, saisissez son matricule ou laissez vide (résolution par nom).']);
    worksheet.addRow(['📋 Un élève peut avoir plusieurs lignes (une par année scolaire d\'arriéré).']);
    worksheet.addRow(['💡 Pour ajouter une feuille pour une nouvelle classe, configurez-la d\'abord dans Paramètres > Classes, puis re-téléchargez ce template.']);

    // Styler les lignes d'instructions
    const lastRow = worksheet.rowCount;
    for (let i = lastRow - 7; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
    }
  }

  private async parseExcelFile(fileDataUrl: string): Promise<ExcelJS.Workbook> {
    const base64Match = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64Data = base64Match ? base64Match[2] : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  }

  /**
   * ⭐ Parse une ligne Excel en ArrearsImportRow.
   * sheetName est conservé pour le debug (mais la résolution se fait par matricule/nom).
   */
  private parseRow(row: ExcelJS.Row, rowNumber: number, sheetName: string): ArrearsImportRow {
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
      sheetName,
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
      // 1. Match exact (insensible à la casse) — comportement historique
      const exact = students.find(
        (s) =>
          s.firstName?.toLowerCase() === row.firstName.toLowerCase() &&
          s.lastName?.toLowerCase() === row.lastName.toLowerCase(),
      );
      if (exact) {
        row.resolvedStudentId = exact.id;
      } else {
        // 2. ⭐ Match NORMALISÉ (accents, ponctuation, espaces multiples/finaux)
        //    Les fiches élèves contiennent souvent des variantes de saisie
        //    (« Sèfiou » vs « Séfiou », « Christian  ETEKA » avec double espace,
        //    espaces de fin) qui faisaient échouer l'import avec « Élève
        //    introuvable » alors que l'élève existe. On normalise des deux côtés.
        const normalize = (v: string): string =>
          (v || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // supprime les diacritiques
            .replace(/[^a-zA-Z ]/g, ' ') // ponctuation → espace
            .replace(/\s+/g, ' ') // espaces multiples → un seul
            .trim()
            .toLowerCase();
        const normalized = students.find(
          (s) =>
            normalize(s.firstName) === normalize(row.firstName) &&
            normalize(s.lastName) === normalize(row.lastName),
        );
        if (normalized) {
          row.resolvedStudentId = normalized.id;
        }
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
