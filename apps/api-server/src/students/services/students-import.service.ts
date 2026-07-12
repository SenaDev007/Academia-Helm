/**
 * ============================================================================
 * STUDENTS IMPORT SERVICE — Import en masse d'élèves via Excel (multi-feuilles)
 * ============================================================================
 *
 * Permet aux établissements d'importer leur liste d'élèves existants
 * depuis un fichier Excel (.xlsx) pour un onboarding rapide.
 *
 * ⭐ TEMPLATE MULTI-FEUILLES (une feuille par classe physique) :
 *   Le template généré contient une feuille par classe configurée dans le
 *   système. Chaque feuille est nommée d'après la classe (ex: "Maternelle 1",
 *   "CP", "6ème", "Terminale S"). L'école n'a plus à saisir le niveau scolaire
 *   ni la classe — ils sont déduits du nom de la feuille.
 *
 * Workflow :
 *   1. L'admin télécharge le template (GET /students/import/template)
 *      → une feuille par classe physique du tenant
 *   2. L'admin remplit chaque feuille (une ligne par élève de cette classe)
 *   3. L'admin upload le fichier → preview (POST /students/import/preview)
 *      → le système valide chaque ligne de chaque feuille
 *   4. L'admin corrige les erreurs éventuelles et confirme
 *   5. Import réel (POST /students/import/run)
 *      → crée Student + StudentEnrollment + StudentAccount pour chaque ligne valide
 *
 * Format Excel (10 colonnes par feuille) :
 *   Prénom | Nom | Date de naissance | Sexe | Lieu de naissance |
 *   Nationalité | Type d'élève |
 *   Nom du parent/tuteur | Téléphone du parent | Email du parent
 *
 * ⚠️ Les arriérés antérieurs NE sont PAS dans ce fichier. Ils sont importés
 * séparément via ArrearsImportService.
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentsLifecycleService } from './students-lifecycle.service';
import { StudentAccountService } from '../../finance/student-account.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

export interface ImportRow {
  rowIndex: number; // 1-based (ligne dans la feuille Excel)
  sheetName: string; // ⭐ nom de la feuille (utile pour le debug)
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  schoolLevelName: string; // déduit du nom de la feuille
  className: string;       // déduit du nom de la feuille
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
  /** ⭐ Classe officielle (AcademicClass) résolue depuis Class.officialClassId.
   *  Permet de remplir StudentEnrollment.academicClassId lors de l'import. */
  resolvedAcademicClassId?: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRow[];
  sheetsProcessed: string[]; // ⭐ liste des feuilles traitées
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
    sheetName: string;
    studentName: string;
    success: boolean;
    error?: string;
    studentId?: string;
  }>;
}

@Injectable()
export class StudentsImportService {
  private readonly logger = new Logger(StudentsImportService.name);

  // ⭐ En-têtes attendues (10 colonnes — sans "Niveau scolaire" ni "Classe"
  // car ils sont déduits du nom de la feuille).
  private static readonly HEADERS = [
    'Prénom',
    'Nom',
    'Date de naissance',
    'Sexe',
    'Lieu de naissance',
    'Nationalité',
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
   * Parse un fichier Excel (base64 data URL) et valide chaque ligne de chaque feuille.
   * ⭐ Multi-feuilles : chaque feuille = une classe physique.
   * Retourne un aperçu sans créer d'élèves.
   */
  async previewImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
  ): Promise<ImportPreviewResult> {
    const workbook = await this.parseExcelFile(fileDataUrl);

    // Pré-charger les niveaux et classes du tenant pour la résolution
    const schoolLevels = await this.prisma.schoolLevel.findMany({
      where: { tenantId },
      select: { id: true, name: true, code: true },
    });
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        schoolLevelId: true,
        // ⭐ Inclure la classe officielle (AcademicClass) rattachée à chaque section physique.
        // Permet à l'import de remplir StudentEnrollment.academicClassId automatiquement.
        officialClassId: true,
        officialClass: { select: { id: true, name: true } },
      },
    });

    const rows: ImportRow[] = [];
    const sheetsProcessed: string[] = [];

    // ⭐ Itérer sur toutes les feuilles du classeur
    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      // Ignorer les feuilles "instructions" (commençant par _ ou contenant "instruction")
      if (sheetName.startsWith('_') || /instruction/i.test(sheetName)) {
        return;
      }
      sheetsProcessed.push(sheetName);

      // ⭐ Déduire schoolLevelName et className du nom de la feuille
      // Le nom de la feuille DOIT correspondre à une classe existante.
      // On essaie d'abord un match exact, puis un match insensible à la casse.
      const cls = classes.find(
        (c) => c.name.toLowerCase() === sheetName.toLowerCase() ||
               (c.code && c.code.toLowerCase() === sheetName.toLowerCase()),
      );
      if (!cls) {
        // Feuille inconnue — on ignore avec un warning
        this.logger.warn(`Feuille "${sheetName}" ne correspond à aucune classe configurée — ignorée`);
        return;
      }
      const schoolLevel = schoolLevels.find((sl) => sl.id === cls.schoolLevelId);
      const schoolLevelName = schoolLevel?.name || '';
      const className = cls.name;

      // Parcourir les lignes de la feuille
      let isFirstRow = true;
      worksheet.eachRow((row, rowNumber) => {
        if (isFirstRow) {
          // Ligne 1 = en-têtes — skipper
          isFirstRow = false;
          return;
        }
        // Skip lignes vides
        const firstCell = row.getCell(1).value;
        if (!firstCell || (typeof firstCell === 'string' && !firstCell.trim())) {
          return;
        }
        // Skip les lignes d'instructions (commençant par ⚠️ ou 📅)
        if (typeof firstCell === 'string' && /^[⚠️📅👤🎓🏫📦💰📋]/.test(firstCell.trim())) {
          return;
        }

        const parsed = this.parseRow(row, rowNumber, sheetName, schoolLevelName, className);
        this.validateRow(parsed, schoolLevels, classes);
        rows.push(parsed);
      });
    });

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
      sheetsProcessed,
      summary,
    };
  }

  /**
   * Importe réellement les élèves du fichier Excel (multi-feuilles).
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

        // ⭐ Résoudre la classe officielle (AcademicClass) depuis Class.officialClassId.
        // Permet de remplir StudentEnrollment.academicClassId pour que l'élève apparaisse
        // dans l'onglet Inscriptions (qui groupe par classe officielle).
        let academicClassId: string | undefined = row.resolvedAcademicClassId;
        if (!academicClassId && classId) {
          const physicalClass = await this.prisma.class.findFirst({
            where: { id: classId, tenantId },
            select: { officialClassId: true },
          });
          if (physicalClass?.officialClassId) {
            academicClassId = physicalClass.officialClassId;
          }
        }

        // Déterminer enrollmentType
        const enrollmentType = row.isNewStudent === false ? 'REPEAT' : 'NEW';

        // Créer l'élève + enrollment
        // ⭐ On passe AROUND classId (section physique) ET academicClassId (classe officielle).
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
          // ⭐ Classe officielle (AcademicClass) — résolue depuis Class.officialClassId
          academicClassId,
          previousArrears: 0,
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
          sheetName: row.sheetName,
          studentName: `${row.lastName} ${row.firstName}`,
          success: true,
          studentId: student.id,
        });
      } catch (e) {
        this.logger.error(
          `Import feuille "${row.sheetName}" ligne ${row.rowIndex} (${row.lastName} ${row.firstName}): ${e.message}`,
        );
        results.push({
          rowIndex: row.rowIndex,
          sheetName: row.sheetName,
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
   * ⭐ Génère et télécharge le template Excel MULTI-FEUILLES.
   * Une feuille par classe physique configurée dans le système (tenant).
   * Chaque feuille est nommée d'après la classe.
   *
   * Si aucune classe n'est configurée, on tombe sur un template par défaut
   * avec une seule feuille "Élèves" (rétro-compatibilité).
   */
  async downloadTemplate(tenantId: string, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    // ⭐ Récupérer toutes les classes physiques du tenant, triées par niveau puis par nom
    // Inclure la classe officielle (officialClass) pour l'afficher dans les instructions
    // de la feuille — l'admin sait ainsi à quelle classe officielle correspond chaque section.
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
      include: {
        schoolLevel: {
          select: { id: true, name: true, code: true, order: true },
        },
        officialClass: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { schoolLevel: { order: 'asc' } },
        { name: 'asc' },
      ],
    });

    if (classes.length === 0) {
      // Fallback : template par défaut avec une seule feuille
      this.logger.warn(`Aucune classe configurée pour le tenant ${tenantId} — template par défaut`);
      const ws = workbook.addWorksheet('Élèves');
      this.applySheetLayout(ws, '', '', undefined);
      this.addInstructionsRow(ws);
    } else {
      // ⭐ Une feuille par classe physique (section)
      for (const cls of classes) {
        // ⭐ Nom de feuille : nom de la classe physique (limité à 31 chars — limite Excel)
        // + sanitized pour éviter les caractères interdits : \ / ? * [ ]
        const sheetName = this.sanitizeSheetName(cls.name || cls.code || `Classe-${cls.id.substring(0, 8)}`);
        const schoolLevelName = cls.schoolLevel?.name || '';
        // ⭐ Nom de la classe officielle (AcademicClass) pour les instructions
        const officialClassName = cls.officialClass?.name;
        const ws = workbook.addWorksheet(sheetName);
        this.applySheetLayout(ws, schoolLevelName, cls.name, officialClassName);
        this.addInstructionsRow(ws);
      }
    }

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

  /**
   * Nettoie un nom de feuille Excel (max 31 chars, pas de \ / ? * [ ] :).
   */
  private sanitizeSheetName(name: string): string {
    let clean = name.replace(/[\\/?*\[\]:]/g, '-').trim();
    if (clean.length > 31) {
      clean = clean.substring(0, 31);
    }
    return clean || 'Feuille';
  }

  /**
   * Applique la mise en page standard à une feuille : en-têtes + exemples + bordures.
   * @param officialClassName Nom de la classe officielle (AcademicClass) si la section
   *                          physique est rattachée à une classe officielle.
   */
  private applySheetLayout(
    worksheet: ExcelJS.Worksheet,
    schoolLevelName: string,
    className: string,
    officialClassName?: string,
  ): void {
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

    // Lignes d'exemple (ligne 2) — adaptées au niveau/classe de la feuille
    const exampleClassName = className || 'CE1';
    const exampleLevel = schoolLevelName || 'Primaire';
    const examples = [
      ['Marie', 'AKOVI', '15/03/2015', 'F', 'Cotonou', 'Béninoise', 'Nouvel élève', 'Koffi AKOVI', '+229 01 97 22 23 45', 'koffi.akovi@email.com'],
    ];
    examples.forEach((example) => {
      worksheet.addRow(example);
    });

    // Style lignes d'exemple (italique gris)
    const exRow = worksheet.getRow(2);
    exRow.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
    exRow.alignment = { vertical: 'middle' };

    // Bordures sur les colonnes (lignes 1 et 2)
    for (let i = 1; i <= 2; i++) {
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

    // ⭐ Note en haut de feuille (ligne 4) indiquant la classe concernée
    worksheet.addRow([]);
    const noteText = officialClassName
      ? `🏫 Feuille pour la section : ${exampleClassName} (niveau ${exampleLevel}) — ` +
        `classe officielle : ${officialClassName}. ` +
        `Le niveau, la section physique et la classe officielle sont déduits automatiquement du nom de cette feuille.`
      : `🏫 Feuille pour la classe : ${exampleClassName} (${exampleLevel}) — ` +
        `le niveau et la classe sont déduits automatiquement du nom de cette feuille.`;
    const noteRow = worksheet.addRow([noteText]);
    noteRow.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
  }

  /**
   * Ajoute les lignes d'instructions en bas de feuille.
   */
  private addInstructionsRow(worksheet: ExcelJS.Worksheet): void {
    worksheet.addRow([]);
    worksheet.addRow(['⚠️ Lignes d\'exemple à supprimer avant import. Respectez l\'ordre des colonnes.']);
    worksheet.addRow(['📅 Date de naissance au format JJ/MM/AAAA (ex: 15/03/2015)']);
    worksheet.addRow(["👤 Sexe : M (Garçon) ou F (Fille)"]);
    worksheet.addRow(["📦 Type d'élève : \"Nouvel élève\" (paie frais d'inscription) ou \"Ancien élève\" (paie frais de réinscription)"]);
    worksheet.addRow(['💰 Arriérés antérieurs : ⚠️ NON inclus dans ce fichier — utilisez l\'import d\'arriérés dédié (module Recouvrement).']);
    worksheet.addRow(['📋 Chaque feuille correspond à une classe physique configurée dans votre établissement.']);
    worksheet.addRow(['💡 Pour ajouter une feuille pour une nouvelle classe, configurez-la d\'abord dans Paramètres > Classes, puis re-téléchargez ce template.']);

    // Styler les lignes d'instructions
    const lastRow = worksheet.rowCount;
    for (let i = lastRow - 6; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
    }
  }

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

  /**
   * Parse une ligne Excel en ImportRow.
   * ⭐ schoolLevelName et className sont déduits du nom de la feuille.
   */
  private parseRow(
    row: ExcelJS.Row,
    rowNumber: number,
    sheetName: string,
    schoolLevelName: string,
    className: string,
  ): ImportRow {
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

    // Parse sexe (colonne 4)
    const genderRaw = getCell(4).toUpperCase();
    let gender: string | null = null;
    if (genderRaw === 'M' || genderRaw === 'GARCON' || genderRaw === 'GARÇON') {
      gender = 'M';
    } else if (genderRaw === 'F' || genderRaw === 'FILLE') {
      gender = 'F';
    }

    // ⭐ Parse type d'élève (colonne 7 — anciennement colonne 9)
    const typeRaw = getCell(7).toLowerCase();
    let isNewStudent: boolean | null = null;
    if (typeRaw.includes('nouvel') || typeRaw.includes('nouveau') || typeRaw === 'new') {
      isNewStudent = true;
    } else if (typeRaw.includes('ancien') || typeRaw.includes('reinscription') || typeRaw === 'old') {
      isNewStudent = false;
    }

    return {
      rowIndex: rowNumber,
      sheetName,
      firstName: getCell(1),
      lastName: getCell(2),
      dateOfBirth,
      gender,
      placeOfBirth: getCell(5) || null,
      nationality: getCell(6) || null,
      // ⭐ Déduits du nom de la feuille, pas de la ligne
      schoolLevelName,
      className,
      isNewStudent,
      guardianName: getCell(8) || null,
      guardianPhone: getCell(9) || null,
      guardianEmail: getCell(10) || null,
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
    // ⭐ Niveau scolaire — déduit du nom de la feuille, mais on vérifie qu'il existe
    if (!row.schoolLevelName) {
      row.errors.push('Niveau scolaire non déduit (feuille sans classe correspondante ?)');
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
    // ⭐ Classe — déduite du nom de la feuille, mais on vérifie qu'elle existe
    if (!row.className) {
      row.errors.push('Classe non déduite (feuille sans classe correspondante ?)');
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
          // ⭐ Résoudre aussi la classe officielle (AcademicClass)
          row.resolvedAcademicClassId = clsAnyLevel.officialClassId || undefined;
        } else {
          row.errors.push(
            `Classe "${row.className}" introuvable. Vérifiez le nom exact dans Paramètres > Classes`,
          );
        }
      } else {
        row.resolvedClassId = cls.id;
        // ⭐ Résoudre aussi la classe officielle (AcademicClass)
        row.resolvedAcademicClassId = cls.officialClassId || undefined;
      }
    }
    // Type d'élève obligatoire
    if (row.isNewStudent === null) {
      row.errors.push('Type d\'élève manquant (attendu "Nouvel élève" ou "Ancien élève")');
    }

    row.isValid = row.errors.length === 0;
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
