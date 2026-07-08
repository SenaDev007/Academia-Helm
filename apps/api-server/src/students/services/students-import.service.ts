/**
 * ============================================================================
 * STUDENTS IMPORT SERVICE — Import en masse d'élèves via Excel
 * ============================================================================
 *
 * Permet aux établissements d'importer leur liste d'élèves existants
 * depuis un fichier Excel (.xlsx) pour un onboarding rapide.
 *
 * Workflow :
 *   1. L'admin télécharge le template Excel (GET /students/import/template)
 *   2. L'admin remplit le template (une ligne par élève)
 *   3. L'admin upload le fichier → preview (POST /students/import/preview)
 *      → le système valide chaque ligne et retourne les erreurs
 *   4. L'admin corrige les erreurs éventuelles et confirme
 *   5. Import réel (POST /students/import/run)
 *      → crée Student + StudentEnrollment + StudentAccount pour chaque ligne valide
 *
 * Format Excel (13 colonnes) :
 *   Prénom | Nom | Date de naissance | Sexe | Lieu de naissance |
 *   Nationalité | Niveau scolaire | Classe | Type d'élève |
 *   Nom du parent | Téléphone du parent | Email du parent
 *
 * ⚠️ Les arriérés antérieurs NE sont PAS dans ce fichier. Ils sont importés
 * séparément via ArrearsImportService (un élève peut avoir des arriérés sur
 * plusieurs années, ce qui nécessite un fichier dédié).
 *
 * Utilise ExcelJS (déjà installé côté backend).
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StudentsLifecycleService } from './services/students-lifecycle.service';
import { StudentAccountService } from '../finance/student-account.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export interface ImportRow {
  rowIndex: number; // 1-based (ligne dans le fichier Excel)
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  schoolLevelName: string;
  className: string;
  isNewStudent: boolean | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  // Validation
  errors: string[];
  isValid: boolean;
  // Résolution (rempli pendant le run)
  resolvedSchoolLevelId?: string;
  resolvedClassId?: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRow[];
  summary: {
    newStudents: number;
    oldStudents: number;
    byLevel: Record<string, number>;
    byClass: Record<string, number>;
  };
}

export interface ImportRunResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  results: Array<{
    rowIndex: number;
    studentName: string;
    success: boolean;
    error?: string;
    studentId?: string;
  }>;
}

@Injectable()
export class StudentsImportService {
  private readonly logger = new Logger(StudentsImportService.name);

  // En-têtes attendues (dans l'ordre des colonnes)
  // Note : les arriérés antérieurs NE sont PAS dans ce fichier — ils sont
  // importés séparément via ArrearsImportService (un élève peut avoir des
  // arriérés sur plusieurs années, ce qui nécessite un fichier dédié).
  private static readonly HEADERS = [
    'Prénom',
    'Nom',
    'Date de naissance',
    'Sexe',
    'Lieu de naissance',
    'Nationalité',
    'Niveau scolaire',
    'Classe',
    "Type d'élève",
    'Nom du parent/tuteur',
    'Téléphone du parent',
    'Email du parent',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycleService: StudentsLifecycleService,
    private readonly studentAccountService: StudentAccountService,
  ) {}

  /**
   * Parse un fichier Excel (base64 data URL) et valide chaque ligne.
   * Retourne un aperçu sans créer d'élèves.
   */
  async previewImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
  ): Promise<ImportPreviewResult> {
    const workbook = await this.parseExcelFile(fileDataUrl);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Aucune feuille trouvée dans le fichier Excel');
    }

    // Pré-charger les niveaux et classes du tenant pour la résolution
    const schoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true },
    });
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true, schoolLevelId: true },
    });

    const rows: ImportRow[] = [];
    let headerRow: ExcelJS.Row | null = null;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headerRow = row;
        return;
      }
      // Skip lignes vides
      const firstCell = row.getCell(1).value;
      if (!firstCell || (typeof firstCell === 'string' && !firstCell.trim())) {
        return;
      }

      const parsed = this.parseRow(row, rowNumber);
      this.validateRow(parsed, schoolLevels, classes);
      rows.push(parsed);
    });

    // Vérifier les en-têtes
    if (headerRow) {
      this.validateHeaders(headerRow);
    }

    const validRows = rows.filter((r) => r.isValid).length;
    const invalidRows = rows.length - validRows;

    // Statistiques
    const summary = {
      newStudents: rows.filter((r) => r.isValid && r.isNewStudent === true).length,
      oldStudents: rows.filter((r) => r.isValid && r.isNewStudent === false).length,
      byLevel: {} as Record<string, number>,
      byClass: {} as Record<string, number>,
    };
    rows.filter((r) => r.isValid).forEach((r) => {
      summary.byLevel[r.schoolLevelName] = (summary.byLevel[r.schoolLevelName] || 0) + 1;
      summary.byClass[r.className] = (summary.byClass[r.className] || 0) + 1;
    });

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      rows,
      summary,
    };
  }

  /**
   * Importe réellement les élèves du fichier Excel.
   * Crée Student + StudentEnrollment + StudentAccount pour chaque ligne valide.
   */
  async runImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
    userId: string,
  ): Promise<ImportRunResult> {
    const preview = await this.previewImport(tenantId, academicYearId, fileDataUrl);
    const validRows = preview.rows.filter((r) => r.isValid);

    const results: ImportRunResult['results'] = [];

    for (const row of validRows) {
      try {
        // Résoudre schoolLevelId et classId
        const schoolLevel = await this.resolveSchoolLevel(tenantId, row.schoolLevelName);
        const classId = await this.resolveClassId(tenantId, schoolLevel.id, row.className);

        // Déterminer enrollmentType
        const enrollmentType = row.isNewStudent === false ? 'REPEAT' : 'NEW';

        // Créer l'élève + enrollment
        const student = await this.lifecycleService.preRegister(tenantId, {
          academicYearId,
          schoolLevelId: schoolLevel.id,
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: row.dateOfBirth || undefined,
          gender: row.gender || undefined,
          placeOfBirth: row.placeOfBirth || undefined,
          nationality: row.nationality || undefined,
          classId: classId || undefined,
          previousArrears: 0, // Les arriérés sont importés séparément via ArrearsImportService
          enrollmentType,
        }, userId);

        // Créer le StudentAccount avec les bons frais (INSCRIPTION ou REINSCRIPTION)
        await this.studentAccountService.getOrCreate(
          student.id,
          tenantId,
          academicYearId,
          enrollmentType,
        );

        // Créer le guardian si fourni
        if (row.guardianName || row.guardianPhone || row.guardianEmail) {
          await this.createGuardian(tenantId, student.id, row);
        }

        results.push({
          rowIndex: row.rowIndex,
          studentName: `${row.lastName} ${row.firstName}`,
          success: true,
          studentId: student.id,
        });
      } catch (e) {
        this.logger.error(
          `Import ligne ${row.rowIndex} (${row.lastName} ${row.firstName}): ${e.message}`,
        );
        results.push({
          rowIndex: row.rowIndex,
          studentName: `${row.lastName} ${row.firstName}`,
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
   * Génère et télécharge le template Excel vierge avec en-têtes et exemples.
   */
  async downloadTemplate(res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Élèves');

    // Définir les colonnes avec largeurs
    worksheet.columns = StudentsImportService.HEADERS.map((header) => ({
      header,
      key: header,
      width: 22,
    }));

    // Style en-tête (ligne 1)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D1F6E' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Lignes d'exemple (ligne 2 et 3)
    const examples = [
      ['Marie', 'AKOVI', '15/03/2015', 'F', 'Cotonou', 'Béninoise', 'Primaire', 'CE1', 'Nouvel élève', 'Koffi AKOVI', '+229 01 97 22 23 45', 'koffi.akovi@email.com'],
      ['Jean', 'DOSSOU', '22/09/2014', 'M', 'Porto-Novo', 'Béninoise', 'Primaire', 'CM2', 'Ancien élève', 'Adèle DOSSOU', '+229 01 96 11 22 33', 'adele.dossou@email.com'],
    ];
    examples.forEach((example) => {
      worksheet.addRow(example);
    });

    // Style lignes d'exemple (italique gris)
    for (let i = 2; i <= 3; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
      row.alignment = { vertical: 'middle' };
    }

    // Note explicative (ligne 5)
    worksheet.addRow([]);
    worksheet.addRow(['⚠️ Lignes d\'exemple à supprimer avant import. Respectez l\'ordre des colonnes.']);
    worksheet.addRow(['📅 Date de naissance au format JJ/MM/AAAA (ex: 15/03/2015)']);
    worksheet.addRow(["👤 Sexe : M (Garçon) ou F (Fille)"]);
    worksheet.addRow(['🎓 Niveau scolaire : Maternelle, Primaire ou Secondaire (doit exister dans votre établissement)']);
    worksheet.addRow(['🏫 Classe : nom exact de la classe dans votre établissement (ex: CE1, 6ème, Terminale)']);
    worksheet.addRow(["📦 Type d'élève : \"Nouvel élève\" (paie frais d'inscription) ou \"Ancien élève\" (paie frais de réinscription)"]);
    worksheet.addRow(['💰 Arriérés antérieurs : ⚠️ NON inclus dans ce fichier — utilisez l\'import d\'arriérés dédié (module Recouvrement).']);
    worksheet.addRow(['📋 Toutes les colonnes en gras sont obligatoires. Les autres sont optionnelles.']);

    for (let i = 5; i <= 13; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
    }

    // Bordures sur les colonnes
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
        });
      }
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-eleves-academia-helm.xlsx"',
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Méthodes privées ───

  private async parseExcelFile(fileDataUrl: string): Promise<ExcelJS.Workbook> {
    // Extraire le base64 du data URL
    const base64Match = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      // Si c'est déjà du base64 brut
      const buffer = Buffer.from(fileDataUrl, 'base64');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      return workbook;
    }

    const buffer = Buffer.from(base64Match[2], 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  }

  private parseRow(row: ExcelJS.Row, rowNumber: number): ImportRow {
    const getCell = (col: number): string => {
      const val = row.getCell(col).value;
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') return String(val);
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'object' && 'text' in val) return String((val as any).text || '').trim();
      if (typeof val === 'object' && 'result' in val) return String((val as any).result || '').trim();
      return String(val).trim();
    };

    // Parse date de naissance (format JJ/MM/AAAA ou objet Date Excel)
    const dobCell = row.getCell(3).value;
    let dateOfBirth: Date | null = null;
    if (dobCell instanceof Date) {
      dateOfBirth = dobCell;
    } else if (typeof dobCell === 'string' && dobCell.trim()) {
      const parts = dobCell.trim().split(/[\/\-.]/);
      if (parts.length === 3) {
        const [d, m, y] = parts.map(Number);
        if (d && m && y) {
          dateOfBirth = new Date(y, m - 1, d);
        }
      }
    } else if (typeof dobCell === 'number') {
      // Excel serial date
      dateOfBirth = new Date(Date.UTC(1899, 11, 30) + dobCell * 24 * 60 * 60 * 1000);
    }

    // Parse sexe
    const genderRaw = getCell(4).toUpperCase();
    let gender: string | null = null;
    if (genderRaw === 'M' || genderRaw === 'GARCON' || genderRaw === 'GARÇON') {
      gender = 'M';
    } else if (genderRaw === 'F' || genderRaw === 'FILLE') {
      gender = 'F';
    }

    // Parse type d'élève (colonne 9)
    const typeRaw = getCell(9).toLowerCase();
    let isNewStudent: boolean | null = null;
    if (typeRaw.includes('nouvel') || typeRaw.includes('nouveau') || typeRaw === 'new') {
      isNewStudent = true;
    } else if (typeRaw.includes('ancien') || typeRaw.includes('reinscription') || typeRaw === 'old') {
      isNewStudent = false;
    }

    return {
      rowIndex: rowNumber,
      firstName: getCell(1),
      lastName: getCell(2),
      dateOfBirth,
      gender,
      placeOfBirth: getCell(5) || null,
      nationality: getCell(6) || null,
      schoolLevelName: getCell(7),
      className: getCell(8),
      isNewStudent,
      guardianName: getCell(10) || null,
      guardianPhone: getCell(11) || null,
      guardianEmail: getCell(12) || null,
      errors: [],
      isValid: true,
    };
  }

  private validateRow(
    row: ImportRow,
    schoolLevels: any[],
    classes: any[],
  ): void {
    // Prénom obligatoire
    if (!row.firstName) {
      row.errors.push('Prénom manquant');
    }
    // Nom obligatoire
    if (!row.lastName) {
      row.errors.push('Nom manquant');
    }
    // Date de naissance obligatoire
    if (!row.dateOfBirth) {
      row.errors.push('Date de naissance manquante ou format invalide (attendu JJ/MM/AAAA)');
    }
    // Sexe obligatoire
    if (!row.gender) {
      row.errors.push('Sexe manquant ou invalide (attendu M ou F)');
    }
    // Niveau scolaire obligatoire + doit exister
    if (!row.schoolLevelName) {
      row.errors.push('Niveau scolaire manquant');
    } else {
      const level = schoolLevels.find(
        (sl) =>
          sl.name.toLowerCase() === row.schoolLevelName.toLowerCase() ||
          sl.code.toLowerCase() === row.schoolLevelName.toLowerCase(),
      );
      if (!level) {
        row.errors.push(
          `Niveau scolaire "${row.schoolLevelName}" introuvable. Niveaux disponibles: ${schoolLevels.map((sl) => sl.name).join(', ')}`,
        );
      } else {
        row.resolvedSchoolLevelId = level.id;
      }
    }
    // Classe obligatoire + doit exister
    if (!row.className) {
      row.errors.push('Classe manquante');
    } else if (row.resolvedSchoolLevelId) {
      const cls = classes.find(
        (c) =>
          c.name.toLowerCase() === row.className.toLowerCase() &&
          c.schoolLevelId === row.resolvedSchoolLevelId,
      );
      if (!cls) {
        // Essayer sans filtrer par niveau
        const clsAnyLevel = classes.find(
          (c) => c.name.toLowerCase() === row.className.toLowerCase(),
        );
        if (clsAnyLevel) {
          row.resolvedClassId = clsAnyLevel.id;
        } else {
          row.errors.push(
            `Classe "${row.className}" introuvable. Vérifiez le nom exact dans Paramètres > Classes`,
          );
        }
      } else {
        row.resolvedClassId = cls.id;
      }
    }
    // Type d'élève obligatoire
    if (row.isNewStudent === null) {
      row.errors.push('Type d\'élève manquant (attendu "Nouvel élève" ou "Ancien élève")');
    }

    row.isValid = row.errors.length === 0;
  }

  private validateHeaders(headerRow: ExcelJS.Row): void {
    const actualHeaders = StudentsImportService.HEADERS.map((_, i) => {
      const val = headerRow.getCell(i + 1).value;
      return typeof val === 'string' ? val.trim() : String(val || '').trim();
    });

    const mismatches: string[] = [];
    StudentsImportService.HEADERS.forEach((expected, i) => {
      if (actualHeaders[i] !== expected) {
        mismatches.push(`Colonne ${i + 1}: attendu "${expected}", trouvé "${actualHeaders[i]}"`);
      }
    });

    if (mismatches.length > 0) {
      this.logger.warn(
        `En-têtes Excel non conformes:\n${mismatches.join('\n')}\n` +
        `L'import continuera mais vérifiez le template.`,
      );
    }
  }

  private async resolveSchoolLevel(tenantId: string, name: string): Promise<any> {
    const level = await this.prisma.schoolLevel.findFirst({
      where: {
        tenantId,
        OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { code: { equals: name, mode: 'insensitive' } },
        ],
      },
    });
    if (!level) {
      throw new Error(`Niveau scolaire "${name}" introuvable`);
    }
    return level;
  }

  private async resolveClassId(
    tenantId: string,
    schoolLevelId: string,
    className: string,
  ): Promise<string | null> {
    const cls = await this.prisma.class.findFirst({
      where: {
        tenantId,
        schoolLevelId,
        name: { equals: className, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (cls) return cls.id;

    // Fallback : chercher sans filtrer par niveau
    const clsAny = await this.prisma.class.findFirst({
      where: {
        tenantId,
        name: { equals: className, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return clsAny?.id || null;
  }

  private async createGuardian(
    tenantId: string,
    studentId: string,
    row: ImportRow,
  ): Promise<void> {
    // Parser le nom du parent
    const parts = (row.guardianName || '').trim().split(' ');
    const lastName = parts[0] || 'Parent';
    const firstName = parts.slice(1).join(' ') || '';

    const guardian = await this.prisma.guardian.create({
      data: {
        tenantId,
        firstName,
        lastName,
        phone: row.guardianPhone,
        email: row.guardianEmail,
        isPrimary: true,
      },
    });

    await this.prisma.studentGuardian.create({
      data: {
        tenantId,
        studentId,
        guardianId: guardian.id,
        isPrimary: true,
        relationship: 'PARENT',
      },
    });
  }
}
