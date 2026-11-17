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
 * ⭐ 2026-11-17 — IMPORT INTELLIGENT (anti-doublons) :
 *   - Chaque ligne est rapprochée des élèves EXISTANTS du tenant par identité
 *     normalisée (prénom + nom insensible casse/accents + date de naissance,
 *     à défaut téléphone du parent, à défaut nom unique en base).
 *   - Un élève déjà existant est MIS À JOUR (jamais dupliqué) : champs
 *     identité complétés uniquement s'ils manquent, matricule CONSERVÉ.
 *   - Si l'élève est retrouvé dans une AUTRE classe que sa classe actuelle :
 *     changement de classe géré automatiquement (changeClass + ClassTransfer
 *     + synchronisation classe officielle) — aucun doublon en base.
 *   - Si l'élève existe (année précédente) mais n'a pas d'inscription pour
 *     l'année cible : réinscription automatique (RE_ENROLLED).
 *   - Un élève apparaissant deux fois dans le fichier (ex : deux feuilles)
 *     est signalé comme doublon de fichier — seule la 1re occurrence compte.
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
import { MatriculeService } from './matricule.service';
import { ParentUserProvisioningService } from './parent-user-provisioning.service';
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
  /** ⭐ 2026-11-17 — Rapprochement avec un élève EXISTANT (import intelligent).
   *  Présent uniquement si un élève correspondant a été trouvé en base. */
  match?: ImportRowMatch;
  /** ⭐ Avertissements NON bloquants sur la ligne (ex : homonymes non fusionnables,
   *  date de naissance divergente d'un homonyme existant) — affichés dans le
   *  preview pour transparence, sans invalider la ligne. */
  warnings?: string[];
}

/** Action décidée par l'import intelligent pour une ligne rapprochée. */
export type ImportMatchAction = 'UPDATE_INFO' | 'MOVE_CLASS' | 'REENROLL';

/** Fiabilité du rapprochement (affichée dans le preview pour transparence). */
export type ImportMatchConfidence = 'DOB' | 'PHONE' | 'NAME';

/** Résultat du rapprochement d'une ligne avec la base existante. */
export interface ImportRowMatch {
  existingStudentId: string;
  existingMatricule: string | null;
  /** Classe actuelle de l'élève pour l'année cible (null si pas encore inscrit). */
  existingClassName: string | null;
  confidence: ImportMatchConfidence;
  action: ImportMatchAction;
  warnings: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportRow[];
  sheetsProcessed: string[]; // ⭐ liste des feuilles traitées
  /** ⭐ 2026-11-17 — Feuilles PRÉSENTES dans le fichier mais IGNORÉES car leur nom
   *  ne correspond à aucune classe configurée pour l'année cible. Transparence
   *  anti-silence : avant, l'école ne voyait jamais que « 6ème » avait été écartée
   *  (les élèves de la feuille n'apparaissaient tout simplement pas). */
  skippedSheets: string[];
  summary: {
    newStudents: number;
    oldStudents: number;
    byLevel: Record<string, number>;
    byClass: Record<string, number>;
    /** ⭐ 2026-11-17 — Import intelligent : répartition des actions prévues. */
    created: number;
    updatedInfo: number;
    movedClass: number;
    reenrolled: number;
  };
}

export interface ImportRunResult {
  totalRows: number;
  succeeded: number;
  failed: number;
  /** ⭐ 2026-11-17 — Import intelligent : répartition des actions effectuées. */
  summary: {
    created: number;
    updatedInfo: number;
    movedClass: number;
    reenrolled: number;
  };
  results: Array<{
    rowIndex: number;
    sheetName: string;
    studentName: string;
    success: boolean;
    error?: string;
    studentId?: string;
    /** ⭐ Action réellement effectuée pour cette ligne. */
    action?: 'CREATE' | ImportMatchAction;
    /** ⭐ Message explicite (français) décrivant ce qui a été fait. */
    message?: string;
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
    private readonly matriculeService: MatriculeService,
    private readonly parentProvisioningService: ParentUserProvisioningService,
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
    // ⭐ Classes du tenant pour l'ANNÉE CIBLE uniquement — les nouveaux élèves
    // seront inscrits dans cette année ; sans le filtre, une feuille « CI A »
    // pouvait se résoudre sur la classe 2024-2025 (au lieu de 2025-2026).
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId },
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
    const skippedSheets: string[] = [];

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
      // On essaie d'abord un match exact, puis insensible à la casse.
      let cls = classes.find(
        (c) => c.name.toLowerCase() === sheetName.toLowerCase() ||
               (c.code && c.code.toLowerCase() === sheetName.toLowerCase()),
      );
      // ⭐ 2026-11-17 — puis insensible aux ACCENTS (feuille renommée « 1ERE A2 »
      //    alors que la classe s'appelle « 1ère A2 ») — le niveau secondaire
      //    concentre les noms accentués (1ère, 2nde, 3ème…).
      if (!cls) {
        const nSheet = this.normalizeName(sheetName);
        cls = classes.find(
          (c) =>
            this.normalizeName(c.name) === nSheet ||
            (c.code && this.normalizeName(c.code) === nSheet),
        );
      }
      if (!cls) {
        // Feuille inconnue — signalée au preview (transparence) puis ignorée
        skippedSheets.push(sheetName);
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

    // ⭐ 2026-11-17 — IMPORT INTELLIGENT (anti-doublons) :
    //    (1) détection des doublons DANS le fichier (élève figurant sur
    //        plusieurs feuilles / lignes) → erreur explicite sur les occurrences 2+
    //    (2) rapprochement de chaque ligne avec les élèves EXISTANTS du tenant
    //        → row.match (UPDATE_INFO / MOVE_CLASS / REENROLL) ou création
    await this.detectDuplicatesAndMatchRows(tenantId, academicYearId, rows, classes);

    const validRows = rows.filter((r) => r.isValid).length;
    const invalidRows = rows.length - validRows;

    // Statistiques
    const summary = {
      newStudents: rows.filter((r) => r.isValid && r.isNewStudent === true).length,
      oldStudents: rows.filter((r) => r.isValid && r.isNewStudent === false).length,
      byLevel: {} as Record<string, number>,
      byClass: {} as Record<string, number>,
      // ⭐ Import intelligent : répartition des actions prévues
      created: rows.filter((r) => r.isValid && !r.match).length,
      updatedInfo: rows.filter((r) => r.isValid && r.match?.action === 'UPDATE_INFO').length,
      movedClass: rows.filter((r) => r.isValid && r.match?.action === 'MOVE_CLASS').length,
      reenrolled: rows.filter((r) => r.isValid && r.match?.action === 'REENROLL').length,
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
      skippedSheets,
      summary,
    };
  }

  /**
   * Importe réellement les élèves du fichier Excel (multi-feuilles).
   * ⭐ 2026-11-17 — IMPORT INTELLIGENT : une ligne rapprochée d'un élève
   * EXISTANT met à jour cet élève (info / classe / réinscription) au lieu
   * de créer un doublon. Une ligne sans correspondance crée l'élève.
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
        if (row.match) {
          // ⭐ Élève EXISTANT — mise à jour intelligente (aucun doublon créé).
          // Les ids résolus (niveau/classe/classe officielle) proviennent déjà
          // du preview — aucune résolution supplémentaire n'est nécessaire.
          const outcome = await this.updateExistingStudent(
            tenantId,
            academicYearId,
            row,
            row.match,
            userId,
          );

          // Créer/assurer le StudentAccount (compte financier) — idempotent
          try {
            await this.studentAccountService.getOrCreate(
              tenantId,
              outcome.studentId,
              academicYearId,
            );
          } catch (accountErr: any) {
            this.logger.warn(`⚠️ StudentAccount creation failed for existing student ${outcome.studentId}: ${accountErr.message}`);
          }

          // Guardian : mise à jour/dédoublonnée (pas de doublon de parent)
          if (row.guardianName || row.guardianPhone || row.guardianEmail) {
            await this.upsertGuardian(tenantId, outcome.studentId, row);
          }

          results.push({
            rowIndex: row.rowIndex,
            sheetName: row.sheetName,
            studentName: `${row.lastName} ${row.firstName}`,
            success: true,
            studentId: outcome.studentId,
            action: row.match.action,
            message: outcome.message,
          });
        } else {
          // ⭐ Nouvel élève — création (flux historique)
          // Résoudre schoolLevelId et classId
          const schoolLevel = await this.resolveSchoolLevel(tenantId, row.schoolLevelName);
          // ⭐ FIX 2026-11-17 : utiliser l'id de classe résolu par le PREVIEW
          // (filtré sur l'année cible) en priorité ; resolveClassId sert de
          // repli et reçoit désormais academicYearId (cf. commentaire de la
          // méthode) — plus de résolution « heap-order » vers une classe d'une
          // autre année (bug « classes du niveau secondaire »).
          const classId =
            row.resolvedClassId ??
            (await this.resolveClassId(tenantId, schoolLevel.id, row.className, academicYearId));

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

          const student = await this.createNewStudent(
            tenantId,
            academicYearId,
            row,
            classId,
            academicClassId,
            userId,
          );

          results.push({
            rowIndex: row.rowIndex,
            sheetName: row.sheetName,
            studentName: `${row.lastName} ${row.firstName}`,
            success: true,
            studentId: student.id,
            action: 'CREATE',
            message: `Nouvel élève créé${student.matricule ? ` (matricule ${student.matricule})` : ''}`,
          });
        }
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

    const succeeded = results.filter((r) => r.success);
    return {
      totalRows: preview.totalRows,
      succeeded: succeeded.length,
      failed: results.length - succeeded.length,
      summary: {
        created: succeeded.filter((r) => r.action === 'CREATE').length,
        updatedInfo: succeeded.filter((r) => r.action === 'UPDATE_INFO').length,
        movedClass: succeeded.filter((r) => r.action === 'MOVE_CLASS').length,
        reenrolled: succeeded.filter((r) => r.action === 'REENROLL').length,
      },
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
    // Inclure la classe officielle (officialClass) pour l'afficher dans les instructions
    // de la feuille — l'admin sait ainsi à quelle classe officielle correspond chaque section.
    const classes = await this.prisma.class.findMany({
      where: { tenantId, ...(latestYear ? { academicYearId: latestYear.id } : {}) },
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
      // ⭐ Une feuille par classe physique (section) — déduplication défensive des noms
      const usedSheetNames = new Set<string>();
      for (const cls of classes) {
        // ⭐ Nom de feuille : nom de la classe physique (limité à 31 chars — limite Excel)
        // + sanitized pour éviter les caractères interdits : \ / ? * [ ]
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
    worksheet.addRow(['🤖 Import intelligent : un élève déjà présent dans votre base est automatiquement MIS À JOUR (jamais dupliqué) ; s\'il est placé dans une autre classe, sa classe est changée automatiquement.']);
    worksheet.addRow(['🤖 Date de naissance et/ou téléphone du parent fortement recommandés : ils permettent au système de reconnaître vos anciens élèves avec certitude.']);
    worksheet.addRow(['💡 Pour ajouter une feuille pour une nouvelle classe, configurez-la d\'abord dans Paramètres > Classes, puis re-téléchargez ce template.']);

    // Styler les lignes d'instructions
    const lastRow = worksheet.rowCount;
    for (let i = lastRow - 8; i <= lastRow; i++) {
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

    // Parse date de naissance (JJ/MM/AAAA, AAAA-MM-JJ, ou objet Date Excel)
    const dobCell = row.getCell(3).value;
    let dateOfBirth: Date | null = null;
    if (dobCell instanceof Date) {
      dateOfBirth = dobCell;
    } else if (typeof dobCell === 'string' && dobCell.trim()) {
      const parts = dobCell.trim().split(/[\/\-.]/);
      if (parts.length === 3) {
        let d = Number(parts[0]);
        let m = Number(parts[1]);
        let y = Number(parts[2]);
        // ⭐ FIX: détection du format — si le 1er segment a 4 chiffres, c'est
        // de l'ISO AAAA-MM-JJ (ex: 2015-03-10). Sinon JJ/MM/AAAA (ex: 15/03/2015).
        // Avant ce fix, une date ISO était lue à l'envers (d=2015, y=10) et
        // produisait des dates aberrantes (ex: 1915-09-05) stockées en silence.
        if (parts[0].length === 4) {
          [y, m, d] = [d, m, y];
        }
        // Année à 2 chiffres (ex: 15/03/15) → 2000+yy
        if (y < 100) {
          y = y > 50 ? 1900 + y : 2000 + y;
        }
        // Tolère le format US MM/JJ/AAAA (ex: 03/15/2015 → swap)
        if (m > 12 && d <= 12) {
          [d, m] = [m, d];
        }
        // ⭐ Plausibilité — évite de stocker une date aberrante : si le format
        // est incohérent, la date est considérée absente (champ optionnel).
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
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
    // ⭐ Seuls le prénom et le nom sont OBLIGATOIRES.
    // Date de naissance, sexe, type d'élève sont OPTIONNELS — l'utilisateur
    // pourra les compléter plus tard. Mais si une valeur est fournie et que
    // le format est invalide, on rejette (ex: date au mauvais format).

    // Prénom obligatoire
    if (!row.firstName) {
      row.errors.push('Prénom manquant');
    }
    // Nom obligatoire
    if (!row.lastName) {
      row.errors.push('Nom manquant');
    }
    // Date de naissance — OPTIONNELLE, mais si fournie, doit être valide
    // (row.dateOfBirth est déjà null si le format est invalide — parsé plus tôt)
    // On ne pousse plus d'erreur si absente.

    // Sexe — OPTIONNEL, mais si fourni, doit être valide (M ou F)
    // (row.gender est déjà null si invalide — parsé plus tôt)
    // On ne pousse plus d'erreur si absent.

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
          row.resolvedAcademicClassId = clsAnyLevel.officialClassId || undefined;
        } else {
          row.errors.push(
            `Classe "${row.className}" introuvable. Vérifiez le nom exact dans Paramètres > Classes`,
          );
        }
      } else {
        row.resolvedClassId = cls.id;
        row.resolvedAcademicClassId = cls.officialClassId || undefined;
      }
    }
    // Type d'élève — OPTIONNEL (plus obligatoire)
    // Si non fourni, on default à "nouvel élève"
    if (row.isNewStudent === null) {
      row.isNewStudent = true; // Default: nouvel élève
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
    /** ⭐ FIX 2026-11-17 « classes du niveau secondaire » : une classe homonyme
     *  peut exister sur PLUSIEURS années (ex : « 6ème » en 2025-2026 ET
     *  2026-2027). Sans filtre par année, findFirst renvoie une ligne
     *  PHYSIQUEMENT arbitraire (ordre du heap Postgres) → l'élève importé
     *  pouvait être inscrit dans la classe de l'année PASSÉE (invisible dans
     *  l'année courante). L'année cible est désormais TOUJOURS filtrée. */
    academicYearId?: string,
  ): Promise<string | null> {
    // 1) Match exact + niveau + ANNÉE CIBLE (insensible à la casse)
    if (academicYearId) {
      const clsYear = await this.prisma.class.findFirst({
        where: {
          tenantId,
          schoolLevelId,
          academicYearId,
          name: { equals: className, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (clsYear) return clsYear.id;

      // 2) Match sans niveau, mais TOUJOURS dans l'année cible
      const clsAnyLevelYear = await this.prisma.class.findFirst({
        where: {
          tenantId,
          academicYearId,
          name: { equals: className, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (clsAnyLevelYear) return clsAnyLevelYear.id;
    }

    // 3) Repli historique (sans année) — déterministe : la classe la plus
    //    récemment créée gagne (jamais l'ordre du heap)
    const cls = await this.prisma.class.findFirst({
      where: {
        tenantId,
        schoolLevelId,
        name: { equals: className, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (cls) return cls.id;

    // 4) Dernier repli : chercher sans filtrer par niveau (même déterminisme)
    const clsAny = await this.prisma.class.findFirst({
      where: {
        tenantId,
        name: { equals: className, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return clsAny?.id || null;
  }

  // ─── ⭐ 2026-11-17 — IMPORT INTELLIGENT : méthodes privées ───

  /** Normalise un nom pour comparaison : minuscules, sans accents, espaces compressés. */
  private normalizeName(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Normalise un téléphone pour comparaison : uniquement les chiffres. */
  private normalizePhone(value: string): string {
    return (value || '').replace(/\D+/g, '');
  }

  /** Jour calendaire ISO (YYYY-MM-DD) d'une date, insensible à la sérialisation UTC. */
  private isoDay(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * ⭐ (1) Détecte les doublons DANS le fichier et (2) rapproche chaque ligne
   * des élèves EXISTANTS du tenant (toutes années confondues — un élève connu
   * d'une année antérieure est un « ancien », pas un nouvel enregistrement).
   */
  private async detectDuplicatesAndMatchRows(
    tenantId: string,
    academicYearId: string,
    rows: ImportRow[],
    classes: Array<{ id: string; name: string }>,
  ): Promise<void> {
    // ─── (1) Doublons dans le fichier : même identité normalisée sur 2+ lignes ───
    // La 1re occurrence est conservée ; les suivantes sont marquées en erreur
    // pour que l'école corrige le fichier (l'élève ne doit figurer que sur UNE
    // feuille — celle de sa classe).
    const seenInFile = new Map<string, ImportRow>();
    for (const row of rows) {
      const key = `${this.normalizeName(row.firstName)}|${this.normalizeName(row.lastName)}`;
      const first = seenInFile.get(key);
      if (first) {
        row.errors.push(
          `Doublon dans le fichier : cet élève figure déjà dans la feuille « ${first.sheetName} » (ligne ${first.rowIndex}). ` +
          `Un élève ne peut être importé que dans une seule classe — supprimez l'une des deux lignes.`,
        );
        row.isValid = false;
        continue;
      }
      seenInFile.set(key, row);
    }

    // ─── (2) Rapprochement avec la base existante ───
    // Snapshot unique et complet des élèves du tenant (toutes années) :
    // identité + inscriptions. Le rapprochement se fait ensuite en mémoire.
    const existingStudents = await this.prisma.student.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        matricule: true,
        createdAt: true,
        studentEnrollments: {
          where: { tenantId },
          select: {
            id: true,
            academicYearId: true,
            classId: true,
            status: true,
            enrollmentType: true,
            enrollmentDate: true,
          },
          orderBy: { enrollmentDate: 'desc' },
        },
      },
    });
    if (existingStudents.length === 0) return;

    // Index des élèves par nom normalisé (pour le rapprochement par candidats)
    const byName = new Map<string, typeof existingStudents>();
    for (const s of existingStudents) {
      const key = `${this.normalizeName(s.firstName)}|${this.normalizeName(s.lastName)}`;
      const list = byName.get(key);
      if (list) list.push(s);
      else byName.set(key, [s]);
    }

    // Index téléphones des guardians → studentIds (fallback quand la date de
    // naissance manque dans le fichier : le téléphone du parent identifie la famille).
    const phoneToStudentIds = new Map<string, Set<string>>();
    const guardianLinks = await this.prisma.studentGuardian.findMany({
      where: { tenantId },
      select: {
        studentId: true,
        guardian: { select: { phone: true } },
      },
    });
    for (const link of guardianLinks) {
      const digits = this.normalizePhone(link.guardian?.phone || '');
      if (!digits) continue;
      const set = phoneToStudentIds.get(digits) || new Set<string>();
      set.add(link.studentId);
      phoneToStudentIds.set(digits, set);
    }

    for (const row of rows) {
      if (!row.isValid) continue; // lignes déjà invalidées (doublon fichier, etc.)
      const match = this.findExistingMatch(row, byName, phoneToStudentIds);
      if (!match) continue;
      row.match = match;

      // Déterminer l'action pour l'année cible à partir de l'inscription
      // existante la plus récente de CETTE année (si elle existe).
      const student = existingStudents.find((s) => s.id === match.existingStudentId);
      const targetEnrollment = student?.studentEnrollments.find(
        (e) => e.academicYearId === academicYearId,
      );
      if (!targetEnrollment) {
        match.action = 'REENROLL';
        match.existingClassName = null;
      } else if (
        targetEnrollment.classId &&
        row.resolvedClassId &&
        targetEnrollment.classId !== row.resolvedClassId
      ) {
        match.action = 'MOVE_CLASS';
        const cls = classes.find((c) => c.id === targetEnrollment.classId);
        match.existingClassName = cls?.name || null;
      } else {
        match.action = 'UPDATE_INFO';
        const cls = classes.find((c) => c.id === targetEnrollment.classId);
        match.existingClassName = cls?.name || null;
        // Cas tordu : plusieurs inscriptions la même année (historique de bugs
        // de doublons) → on agit sur la plus récente et on avertit.
        const sameYearCount = student?.studentEnrollments.filter(
          (e) => e.academicYearId === academicYearId,
        ).length || 0;
        if (sameYearCount > 1) {
          match.warnings.push(
            `${sameYearCount} inscriptions en base pour cette année — la plus récente sera conservée/corrigée, vérifiez la fiche élève.`,
          );
        }
      }
    }
  }

  /**
   * Rapproche UNE ligne du fichier avec les élèves existants (par candidats du
   * même nom normalisé). Trois niveaux de confiance décroissante :
   *   1. DOB   — date de naissance identique (ou à compléter en base)
   *   2. PHONE — téléphone du parent identique
   *   3. NAME  — nom unique dans tout l'établissement (rapprochement à vérifier)
   * Renvoie undefined si aucun rapprochement sûr n'est possible (→ création).
   */
  private findExistingMatch(
    row: ImportRow,
    byName: Map<string, Array<any>>,
    phoneToStudentIds: Map<string, Set<string>>,
  ): ImportRowMatch | undefined {
    const key = `${this.normalizeName(row.firstName)}|${this.normalizeName(row.lastName)}`;
    const candidates = byName.get(key) || [];
    if (candidates.length === 0) return undefined;

    const warnings: string[] = [];
    const rowDobDay = row.dateOfBirth ? this.isoDay(row.dateOfBirth) : null;
    const rowPhoneDigits = this.normalizePhone(row.guardianPhone || '');

    /** Avertissement non bloquant porté par la LIGNE (visible dans le preview). */
    const rowWarn = (msg: string): void => {
      row.warnings = [...(row.warnings || []), msg];
    };

    let selected: any = null;
    let confidence: ImportMatchConfidence | null = null;

    if (rowDobDay) {
      // Niveau 1 : même nom + même date de naissance exacte
      const exact = candidates.filter(
        (s) => s.dateOfBirth && this.isoDay(s.dateOfBirth) === rowDobDay,
      );
      if (exact.length > 0) {
        selected = exact.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
        confidence = 'DOB';
        if (exact.length > 1) {
          warnings.push(`${exact.length} élèves homonymes avec cette date de naissance en base — le premier créé sera mis à jour (à dédoublonner).`);
        }
      } else {
        // La base a peut-être l'élève SANS date de naissance (import ancien) :
        // on la complètera. Un seul candidat sans DOB → rapprochement sûr.
        const noDob = candidates.filter((s) => !s.dateOfBirth);
        if (noDob.length === 1) {
          selected = noDob[0];
          confidence = 'DOB';
          warnings.push('Date de naissance absente en base — elle sera complétée par cet import.');
        } else if (candidates.length >= 1) {
          rowWarn('Un élève homonyme existe avec une date de naissance différente — un nouvel enregistrement sera créé : vérifiez qu’il ne s’agit pas du même élève.');
          return undefined;
        }
      }
    }

    if (!selected && rowPhoneDigits && phoneToStudentIds.size > 0) {
      // Niveau 2 : même nom + même téléphone de parent (la famille est identifiée)
      const linkedIds = phoneToStudentIds.get(rowPhoneDigits);
      if (linkedIds) {
        const byPhone = candidates.filter((s) => linkedIds.has(s.id));
        if (byPhone.length > 0) {
          selected = byPhone.slice().sort((a, b) => a.createdAt - b.createdAt)[0];
          confidence = 'PHONE';
          if (byPhone.length > 1) {
            warnings.push(`${byPhone.length} élèves homonymes de cette famille — le premier créé sera mis à jour (à dédoublonner).`);
          }
        }
      }
    }

    if (!selected) {
      // Niveau 3 : nom strictement unique dans l'établissement → rapprochement
      // probable mais à confirmer (signalé comme tel dans le preview).
      if (candidates.length === 1) {
        selected = candidates[0];
        confidence = 'NAME';
        warnings.push('Rapprochement par le nom seul (ni date de naissance, ni téléphone fournis) — vérifiez la fiche après import.');
      } else {
        rowWarn(`${candidates.length} élèves homonymes existent en base sans élément distinctif (ni date de naissance, ni téléphone) — un nouvel enregistrement sera créé ; complétez la date de naissance pour fusionner les doublons existants.`);
        return undefined;
      }
    }

    if (!selected || !confidence) return undefined;

    return {
      existingStudentId: selected.id,
      existingMatricule: selected.matricule ?? null,
      existingClassName: null, // rempli par detectDuplicatesAndMatchRows selon l'année cible
      confidence,
      action: 'UPDATE_INFO', // valeur par défaut, affinée ensuite
      warnings,
    };
  }

  /**
   * Flux historique de création d'un NOUVEL élève (extrait de runImport) :
   * preRegister → matricule → ADMITTED. Retourne l'élève créé.
   */
  private async createNewStudent(
    tenantId: string,
    academicYearId: string,
    row: ImportRow,
    classId: string | null,
    academicClassId: string | undefined,
    userId: string,
  ): Promise<{ id: string; matricule: string | null }> {
    const schoolLevel = await this.resolveSchoolLevel(tenantId, row.schoolLevelName);
    const enrollmentType = row.isNewStudent === false ? 'REPEAT' : 'NEW';

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
      academicClassId,
      previousArrears: 0,
      enrollmentType,
      // ⭐ 2026-11-17 — l'import intelligent fait SON PROPRE rapprochement
      //    anti-doublon en amont (detectDuplicatesAndMatchRows) : seules des
      //    lignes sans correspondance atteignent la création. On bypass donc
      //    le garde-fou homonymes de preRegister (qui bloquerait les homonymes
      //    volontairement créés avec avertissement).
      allowDuplicate: true,
    }, userId);

    // ⭐ Générer le matricule automatiquement après la pré-inscription.
    // preRegister crée l'élève avec statut PRE_REGISTERED mais SANS matricule.
    let matricule: string | null = null;
    try {
      const generated = await this.matriculeService.generate(tenantId, academicYearId);
      matricule = generated.matricule;
      await this.prisma.student.update({
        where: { id: student.id },
        data: {
          matricule: generated.matricule,
          enrollmentYear: generated.enrollmentYear,
          studentCode: generated.matricule,
        },
      });
      // Passer l'enrollment à ADMITTED (comme admitStudent le ferait)
      await this.prisma.studentEnrollment.updateMany({
        where: { studentId: student.id, academicYearId },
        data: { status: 'ADMITTED' },
      });
      this.logger.log(`✅ Matricule generated for imported student ${student.id}: ${generated.matricule}`);
    } catch (matriculeErr: any) {
      this.logger.warn(`⚠️ Matricule generation failed for student ${student.id}: ${matriculeErr.message}`);
    }

    // ⭐ Créer le StudentAccount (compte financier) avec les bons frais
    try {
      await this.studentAccountService.getOrCreate(tenantId, student.id, academicYearId);
    } catch (accountErr: any) {
      this.logger.warn(`⚠️ StudentAccount creation failed for student ${student.id}: ${accountErr.message}`);
    }

    // Créer le guardian si fourni
    if (row.guardianName || row.guardianPhone || row.guardianEmail) {
      await this.createGuardian(tenantId, student.id, row);
    }

    return { id: student.id, matricule };
  }

  /**
   * ⭐ Mise à jour intelligente d'un élève EXISTANT rapproché par l'import.
   *
   * - Champs identité : complétés UNIQUEMENT s'ils manquent (jamais écrasés).
   * - Matricule : CONSERVÉ (généré seulement s'il manque).
   * - REENROLL    : aucune inscription pour l'année cible → nouvelle inscription
   *                 (statut RE_ENROLLED) — l'historique des années passées est conservé.
   * - MOVE_CLASS  : inscrit cette année dans une autre classe → changement de
   *                 classe via StudentsLifecycleService.changeClass (trace
   *                 ClassTransfer + synchronisation de la classe officielle).
   * - UPDATE_INFO : déjà inscrit dans cette classe → backfills légers
   *                 (classe officielle, affectation manquante, statut PRE_REGISTERED → ADMITTED).
   */
  private async updateExistingStudent(
    tenantId: string,
    academicYearId: string,
    row: ImportRow,
    match: ImportRowMatch,
    userId: string,
  ): Promise<{ studentId: string; message: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: match.existingStudentId, tenantId },
    });
    if (!student) {
      throw new Error('Élève existant introuvable en base (rapprochement obsolète)');
    }

    const filled: string[] = [];

    // ─── 1. Champs identité : politique de « complétion » (fill-missing) ───
    const identityPatch: any = { currentAcademicYearId: academicYearId };
    if (!student.dateOfBirth && row.dateOfBirth) {
      identityPatch.dateOfBirth = row.dateOfBirth;
      filled.push('date de naissance');
    }
    if (!student.gender && row.gender) {
      identityPatch.gender = row.gender;
      filled.push('sexe');
    }
    if (!student.placeOfBirth && row.placeOfBirth) {
      identityPatch.placeOfBirth = row.placeOfBirth;
      filled.push('lieu de naissance');
    }
    if (!student.nationality && row.nationality) {
      identityPatch.nationality = row.nationality;
      filled.push('nationalité');
    }
    await this.prisma.student.update({
      where: { id: student.id },
      data: identityPatch,
    });

    // ─── 2. Matricule : conservé s'il existe, généré s'il manque ───
    let matricule = student.matricule || null;
    if (!matricule) {
      try {
        const generated = await this.matriculeService.generate(tenantId, academicYearId);
        matricule = generated.matricule;
        await this.prisma.student.update({
          where: { id: student.id },
          data: {
            matricule: generated.matricule,
            enrollmentYear: generated.enrollmentYear,
            studentCode: generated.matricule,
          },
        });
        filled.push('matricule');
      } catch (matriculeErr: any) {
        this.logger.warn(`⚠️ Matricule generation failed for existing student ${student.id}: ${matriculeErr.message}`);
      }
    }

    // ─── 3. Réconciliation de l'inscription pour l'année cible ───
    let message = '';
    if (match.action === 'REENROLL' || !match.action) {
      // Pas d'inscription pour l'année cible → réinscription (flux lifecycle
      // réutilisé : contrôle du plan d'abonnement + audit + compte élève).
      if (!row.resolvedSchoolLevelId || !row.resolvedClassId) {
        throw new Error('Niveau ou classe non résolu pour la réinscription — ligne invalide');
      }
      await this.lifecycleService.reEnroll(
        tenantId,
        {
          studentId: student.id,
          academicYearId,
          schoolLevelId: row.resolvedSchoolLevelId,
          classId: row.resolvedClassId,
        },
        userId,
      );
      // Compléter l'inscription créée : classe officielle + type de frais
      // déclaré dans le fichier (REPEAT vs NEW).
      const newEnrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId: student.id, academicYearId, tenantId },
        orderBy: { enrollmentDate: 'desc' },
      });
      if (newEnrollment) {
        await this.prisma.studentEnrollment.update({
          where: { id: newEnrollment.id },
          data: {
            ...(row.resolvedAcademicClassId && { academicClassId: row.resolvedAcademicClassId }),
            enrollmentType: row.isNewStudent === false ? 'REPEAT' : 'NEW',
          },
        });
      }
      message =
        `Élève existant réinscrit pour l'année` +
        (match.existingMatricule ? ` (matricule ${match.existingMatricule})` : '') +
        (filled.length ? ` — complété : ${filled.join(', ')}` : '');
    } else if (match.action === 'MOVE_CLASS') {
      // Inscrit cette année dans une AUTRE classe → changement de classe
      // (réutilise changeClass : synchronisation classe officielle + trace
      // ClassTransfer + audit — jamais de double inscription).
      if (!row.resolvedClassId) {
        throw new Error('Classe cible non résolue pour le changement de classe');
      }
      await this.lifecycleService.changeClass(
        tenantId,
        {
          studentId: student.id,
          academicYearId,
          newClassId: row.resolvedClassId,
          reason: `Réaffectation automatique lors de l'import en masse (feuille « ${row.sheetName} »)`,
        },
        userId,
      );
      message =
        `Changement de classe : ${match.existingClassName || 'sans classe'} → ${row.className}` +
        (match.existingMatricule ? ` (matricule ${match.existingMatricule})` : '') +
        (filled.length ? ` — complété : ${filled.join(', ')}` : '');
    } else {
      // UPDATE_INFO — déjà inscrit dans cette classe : backfills légers
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: { studentId: student.id, academicYearId, tenantId },
        orderBy: { enrollmentDate: 'desc' },
      });
      if (enrollment) {
        const patch: any = {};
        if (!enrollment.academicClassId && row.resolvedAcademicClassId) {
          patch.academicClassId = row.resolvedAcademicClassId;
          filled.push('classe officielle');
        }
        if (!enrollment.classId && row.resolvedClassId) {
          patch.classId = row.resolvedClassId;
          filled.push('affectation de classe');
        }
        if (enrollment.status === 'PRE_REGISTERED') {
          patch.status = 'ADMITTED';
          filled.push('statut admis');
        }
        if (Object.keys(patch).length > 0) {
          await this.prisma.studentEnrollment.update({
            where: { id: enrollment.id },
            data: patch,
          });
        }
      }
      message =
        `Élève existant mis à jour — aucun doublon créé` +
        (match.existingMatricule ? ` (matricule ${match.existingMatricule})` : '') +
        (filled.length ? ` — complété : ${filled.join(', ')}` : '');
    }

    // ─── 4. Audit dédié (best-effort) ───
    await this.logImportAudit(tenantId, student.id, userId, {
      action: match.action,
      sheetName: row.sheetName,
      rowIndex: row.rowIndex,
      fieldsFilled: filled,
      matricule: matricule || match.existingMatricule || null,
    });

    return { studentId: student.id, message };
  }

  /**
   * ⭐ Guardian intelligent : ne crée JAMAIS de doublon de parent.
   *   1. L'élève a déjà un guardian → on complète le guardian principal
   *      (téléphone/email) si ces champs manquent.
   *   2. Sinon, un guardian du TENANT avec le même téléphone (fratrie) → on
   *      rattache ce guardian existant à l'élève.
   *   3. Sinon, création (flux historique).
   */
  private async upsertGuardian(
    tenantId: string,
    studentId: string,
    row: ImportRow,
  ): Promise<void> {
    // 1. L'élève a-t-il déjà un guardian rattaché ?
    const links = await this.prisma.studentGuardian.findMany({
      where: { tenantId, studentId },
      include: { guardian: true },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (links.length > 0) {
      const primary = links[0];
      const patch: any = {};
      if (!primary.guardian.phone && row.guardianPhone) {
        patch.phone = row.guardianPhone;
      }
      if (!primary.guardian.email && row.guardianEmail) {
        patch.email = row.guardianEmail;
      }
      if (Object.keys(patch).length > 0) {
        await this.prisma.guardian.update({
          where: { id: primary.guardianId },
          data: patch,
        });
      }
      return; // pas de nouveau guardian — zéro doublon
    }

    // 2. Guardian existant dans le tenant avec le même téléphone (fratrie) ?
    const digits = this.normalizePhone(row.guardianPhone || '');
    if (digits) {
      const tenantGuardians = await this.prisma.guardian.findMany({
        where: { tenantId, phone: { not: null } },
        select: { id: true, phone: true },
      });
      const existing = tenantGuardians.find(
        (g) => this.normalizePhone(g.phone || '') === digits,
      );
      if (existing) {
        await this.prisma.studentGuardian.upsert({
          where: {
            studentId_guardianId: { studentId, guardianId: existing.id },
          },
          create: {
            tenantId,
            studentId,
            guardianId: existing.id,
            isPrimary: true,
            relationship: 'PARENT',
          },
          update: { isPrimary: true },
        });
        // Compte parent éventuel (best-effort, non bloquant)
        try {
          await this.parentProvisioningService.ensureUserForGuardian(existing.id);
        } catch (provisioningErr: any) {
          this.logger.warn(
            `Import : compte parent non provisionné pour le guardian ${existing.id} (non bloquant): ${provisioningErr?.message || provisioningErr}`,
          );
        }
        return;
      }
    }

    // 3. Aucun guardian rattaché ni existant → création (flux historique)
    await this.createGuardian(tenantId, studentId, row);
  }

  /** Journal d'audit d'import (best-effort — ne bloque jamais la ligne). */
  private async logImportAudit(
    tenantId: string,
    studentId: string,
    userId: string | undefined,
    afterData: any,
  ): Promise<void> {
    try {
      await this.prisma.studentAuditLog.create({
        data: {
          tenantId,
          studentId,
          userId: userId ?? null,
          action: 'IMPORT_MASS_UPDATE',
          beforeData: null,
          afterData,
        },
      });
    } catch {
      // best-effort
    }
  }

  private async createGuardian(
    tenantId: string,
    studentId: string,
    row: ImportRow,
  ): Promise<void> {
    // Parser le nom du parent
    // ⭐ FIX 2026-11-17 : le modèle GUARDIAN n'a PAS de champ isPrimary (il vit sur
    //    la junction StudentGuardian — posée juste en dessous). Prisma rejetait
    //    « Unknown argument isPrimary » → TOUTE ligne d'import avec un parent nommé
    //    échouait APRÈS création de l'élève (élève créé, parent absent, ligne
    //    marquée en échec) — c'est ce qui faussait l'import de masse réel.
    // ⭐ FIX 2026-11-17 (2) : convention du template « Nom du parent/tuteur » =
    //    « Prénom(s) NOM » (exemple documenté : Koffi AKOVI) — le dernier mot est
    //    le NOM, les premiers sont le(s) prénom(s) (l'ancien parsing inversait).
    const parts = (row.guardianName || '').trim().split(/\s+/).filter(Boolean);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : (parts[0] || 'Parent');
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';

    const guardian = await this.prisma.guardian.create({
      data: {
        tenantId,
        firstName,
        lastName,
        phone: row.guardianPhone,
        email: row.guardianEmail,
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

    // ⭐ 2026-09-19 (demande promoteur) — COMPTE PARENT créé en même temps que
    //    l'élève importé (comme le wizard d'inscription). Non bloquant : une
    //    ligne d'import n'échoue jamais à cause du provisioning du compte.
    try {
      await this.parentProvisioningService.ensureUserForGuardian(guardian.id);
    } catch (provisioningErr: any) {
      this.logger.warn(
        `Import : compte parent non provisionné pour le guardian ${guardian.id} (non bloquant): ${provisioningErr?.message || provisioningErr}`,
      );
    }
  }
}
