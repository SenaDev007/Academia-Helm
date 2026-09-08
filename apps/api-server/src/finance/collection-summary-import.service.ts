/**
 * ============================================================================
 * COLLECTION SUMMARY IMPORT SERVICE — Import en masse du bilan des encaissements
 * ============================================================================
 *
 * Permet aux établissements d'importer les paiements encaissés (bilan des
 * encaissements) depuis un fichier Excel (.xlsx), typiquement les fichiers
 * "POINT" remplis manuellement par les comptables des écoles.
 *
 * ⭐ DEUX FORMATS RECONNAISSABLES (auto-détection par feuille — voir
 *   point-format.parser.ts) :
 *
 *   1. FORMAT « POINT » (standard des écoles — ex: "POINT PRIMAIRE 2025-2026.xlsx")
 *      Une feuille par classe (nom de la feuille = classe) :
 *        Ligne 3 : ANNEE SCOLAIRE 2025-2026 + Scolarité (frais annuels classe)
 *        Lignes 4-5 (en-têtes fusionnés) :
 *          N° | Noms et Prénoms | Arriéré | Tél | Inscript | Unif | Tenue de
 *          Sport | Total frais Généraux | Scolarité (P1..P6) | Total Scolarité |
 *          Reste | Total des payements
 *        Données à partir de la ligne 6, ligne TOTAL en fin de tableau.
 *      → Total encaissé par élève = Inscript + Unif + Tenue + Σ(P1..P6)
 *        (la colonne Arriéré — année antérieure — est INFORMATIVE et n'est
 *        pas importée ici : utiliser l'import dédié des arriérés).
 *      Utile notamment pour importer les encaissements d'une année antérieure
 *      lors de l'onboarding de nouvelles écoles.
 *
 *   2. FORMAT « SIMPLE » (template plat Academia Helm — rétrocompatible)
 *      Noms et Prénoms | Arriéré | Inscription | Tranche 1..6 | Total
 *      (en-tête en ligne 1, une feuille par classe pré-remplie)
 *
 * Workflow :
 *   1. L'admin télécharge le template (GET /finance/collection-summary/import/template)
 *      → une feuille par classe au format POINT, pré-remplie avec les élèves
 *   2. L'école saisit les montants encaissés par élève
 *   3. L'admin upload le fichier → preview (POST /finance/collection-summary/import/preview)
 *   4. L'admin corrige les erreurs et confirme
 *   5. Import réel (POST /finance/collection-summary/import/run)
 *      → pour chaque ligne valide : crée une FinanceTransaction (type=PAYMENT)
 *         + FinanceTransactionAllocation (allouée FIFO sur les AccountBreakdowns)
 *      → met à jour account_breakdowns.paidAmount + student_account.totalPaid
 *      → retourne { imported, skipped, errors, total }
 *
 * Résolution élève : matching flou par nom (même logique que
 * scripts/compare-excel-vs-db.js), avec restriction au bassin d'élèves de la
 * classe portée par le nom de la feuille (fallback global si la classe
 * n'est pas retrouvée) :
 *   - normalisation NFD + minuscules + suppression accents
 *   - variantes "firstName lastName" et "lastName firstName"
 *   - suppression des initiales (ex: "BARANON M." -> "BARANON")
 *   - fallback par préfixe si pas de match exact
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FinanceTransactionService } from './finance-transaction.service';
import { StudentAccountService } from './student-account.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { normalizeName, buildNameVariants } from './fee-override-import.service';
import {
  detectSheetFormat,
  parsePointSheet,
  parseSimpleSheet,
  canonicalYearLabel,
} from './point-format.parser';

// ─── Types publics ───────────────────────────────────────────────────────────

export interface BilanImportRow {
  rowIndex: number;
  sheetName: string; // nom de la feuille (= classe en format POINT classique)
  /** ⭐ Classe détectée dans la feuille (format multi-classes : sections
   *  MATERNELLE/CI/CP/... dans une même feuille). Prioritaire sur sheetName
   *  pour la résolution de la classe et le matching des élèves. */
  className?: string;
  studentName: string; // nom tel que lu dans l'Excel
  arrear: number;
  inscription: number;
  tranches: number[]; // [t1, t2, t3, t4, t5, t6] — 0 si colonne absente
  total: number;
  // ⭐ NOUVEAU — enrichissement format « POINT » (standard des écoles)
  format: 'POINT' | 'SIMPLE';
  unif: number; // frais d'uniforme
  tenue: number; // frais de tenue de sport
  fraisGeneraux: number; // inscription + unif + tenue (équivalent colonne H)
  scolaritePayee: number; // somme des tranches P1..P6 (équivalent colonne O)
  reste: number; // reste à payer (informatif)
  arrearNote?: string; // texte trouvé dans la colonne Arriéré ("ABD", "FONDE"...)
  notes: string[]; // notes libres du fichier
  // Validation + resolution
  matchStatus: 'MATCHED' | 'FUZZY' | 'NOT_FOUND';
  matchScore: number; // 0-100
  resolvedStudentId?: string;
  resolvedStudentName?: string; // nom normalise en DB (pour afficher le match)
  errors: string[];
  isValid: boolean;
}

export interface BilanImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: BilanImportRow[];
  sheetsProcessed: string[];
  // ⭐ NOUVEAU — informations par feuille (format détecté + année scolaire lue)
  sheetInfo: Record<string, {
    format: 'POINT' | 'SIMPLE';
    yearLabel?: string;
    classFee?: number;
    /** ⭐ Sections de classes détectées dans la feuille (multi-classes) */
    sections?: string[];
  }>;
  // ⭐ NOUVEAU — avertissement si l'année lue dans le fichier ne correspond pas
  // à l'année scolaire cible sélectionnée pour l'import
  yearMismatch: {
    targetYear: string;
    sheets: Array<{ sheet: string; detected: string }>;
  } | null;
  summary: {
    totalAmount: number;
    bySheet: Record<string, number>;
    /** ⭐ Totaux par classe (sections détectées) — plus fin que bySheet */
    byClass?: Record<string, number>;
    studentsMatched: number;
    studentsNotFound: number;
  };
}

export interface BilanImportRunResult {
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  results: Array<{
    rowIndex: number;
    sheetName: string;
    studentName: string;
    success: boolean;
    transactionId?: string;
    amount?: number;
    error?: string;
  }>;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CollectionSummaryImportService {
  private readonly logger = new Logger(CollectionSummaryImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeTransactionService: FinanceTransactionService,
    private readonly studentAccountService: StudentAccountService,
  ) {}

  // ─── Téléchargement du template ────────────────────────────────────────────

  /**
   * Génère et télécharge le template Excel (une feuille par classe).
   * ⭐ Structure « POINT » — identique au standard des fichiers tenus par les
   * écoles (N° | Noms et Prénoms | Arriéré | Tél | Inscript | Unif | Tenue de
   * Sport | Total frais Généraux | Scolarité P1..P6 | Total Scolarité | Reste |
   * Total des payements), pré-remplie avec les élèves de chaque classe.
   */
  async downloadTemplate(
    tenantId: string,
    academicYearId: string,
    res: Response,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    // ⭐ Libellé de l'année scolaire (pré-rempli ligne 3 de chaque feuille)
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, name: true, label: true },
    });
    const yearLabel = academicYear?.name || academicYear?.label || '';

    // ⭐ Récupérer toutes les classes physiques du tenant POUR L'ANNÉE CIBLE
    // FIX 500 : sans le filtre academicYearId, les classes des années antérieures
    // (qui portent les MÊMES noms — ex: « CI A » en 2024-2025 et 2025-2026)
    // génèrent des feuilles Excel en double et ExcelJS jette
    // « Worksheet name already exists » → erreur 500 au téléchargement du template.
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId },
      include: {
        schoolLevel: { select: { id: true, name: true, code: true, order: true } },
      },
      orderBy: [
        { schoolLevel: { order: 'asc' } },
        { name: 'asc' },
      ],
    });

    // Récupérer les inscriptions actives par classe (avec les élèves)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        classId: { in: classes.map((c) => c.id) },
        status: { in: ['ACTIVE', 'ENROLLED', 'PRE_REGISTERED', 'ADMITTED', 'PROMOTED', 'RE_ENROLLED'] }, // ⭐ PROMOTED/RE_ENROLLED = élèves actifs de l'année (cf. students-prisma activeEnrollmentStatuses)
        student: { status: { not: 'WITHDRAWN' } },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true },
        },
      },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });

    // Grouper les élèves par classId
    const studentsByClass = new Map<string, any[]>();
    for (const e of enrollments) {
      if (!e.classId) continue;
      if (!studentsByClass.has(e.classId)) studentsByClass.set(e.classId, []);
      studentsByClass.get(e.classId)!.push(e.student);
    }

    if (classes.length === 0) {
      // Fallback : template par défaut avec une seule feuille
      this.logger.warn(`Aucune classe configurée pour le tenant ${tenantId} — template par défaut`);
      const ws = workbook.addWorksheet('Bilan');
      this.applyPointSheetLayout(ws, '', yearLabel, []);
    } else {
      // Une feuille par classe — ⭐ déduplication défensive des noms de feuilles
      // (pas de contrainte d'unicité sur Class.name au sein d'une même année :
      // deux sections homonymes feraient planter ExcelJS de la même façon)
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
        this.applyPointSheetLayout(ws, schoolLevelName, yearLabel, studentsInClass);
        this.logger.log(`Feuille "${sheetName}" créée avec ${studentsInClass.length} élève(s) pré-rempli(s)`);
      }
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-bilan-encaissements-academia-helm.xlsx"',
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  // ─── Preview (validation sans création) ────────────────────────────────────

  /**
   * Parse et valide le fichier Excel (multi-feuilles) sans créer de transactions.
   * ⭐ Auto-détection du format de chaque feuille (POINT = standard des écoles,
   * SIMPLE = template plat Academia) puis matching de chaque élève par nom
   * (fuzzy), en priorité parmi les élèves de la classe = nom de la feuille.
   */
  async previewImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
  ): Promise<BilanImportPreviewResult> {
    const workbook = await this.parseExcelFile(fileDataUrl);

    // Pré-charger les élèves + inscriptions de l'année
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        academicYearId,
        status: { in: ['ACTIVE', 'ENROLLED', 'PRE_REGISTERED', 'ADMITTED', 'PROMOTED', 'RE_ENROLLED'] }, // ⭐ PROMOTED/RE_ENROLLED = élèves actifs de l'année (cf. students-prisma activeEnrollmentStatuses)
        student: { status: { not: 'WITHDRAWN' } },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true },
        },
        class: { select: { id: true, name: true } },
      },
    });

    // Index par variante de nom + par matricule (global)
    const studentByNameVariants = new Map<string, any>();
    const studentByMatricule = new Map<string, any>();
    const allStudents: any[] = [];
    // ⭐ Index par classe (pour la restriction du bassin de matching)
    const studentsByClassId = new Map<string, any[]>();
    for (const e of enrollments) {
      const s = e.student;
      allStudents.push({ ...s, className: e.class?.name || '' });
      if (e.classId) {
        if (!studentsByClassId.has(e.classId)) studentsByClassId.set(e.classId, []);
        studentsByClassId.get(e.classId)!.push({ ...s, className: e.class?.name || '' });
      }
      for (const v of buildNameVariants(s.firstName, s.lastName)) {
        if (!studentByNameVariants.has(v)) {
          studentByNameVariants.set(v, { ...s, className: e.class?.name || '' });
        }
      }
      if (s.matricule) {
        studentByMatricule.set(s.matricule.toLowerCase().trim(), { ...s, className: e.class?.name || '' });
      }
      if (s.studentCode) {
        studentByMatricule.set(s.studentCode.toLowerCase().trim(), { ...s, className: e.class?.name || '' });
      }
    }

    // ⭐ Classes du tenant (ANNÉE CIBLE uniquement) → résolution feuille (nom) → classe
    // FIX : les bassins d'élèves sont filtrés par l'année cible ; sans ce filtre, une
    // feuille « CI A » pouvait se résoudre sur la classe 2024-2025 (bassin vide →
    // matching global dégradé) au lieu de la classe 2025-2026.
    const classes = await this.prisma.class.findMany({
      where: { tenantId, academicYearId },
      select: { id: true, name: true, code: true },
    });

    // ⭐ Année cible (pour l'avertissement d'alignement des années)
    const targetYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { id: true, name: true, label: true },
    });

    const rows: BilanImportRow[] = [];
    const sheetsProcessed: string[] = [];
    const sheetInfo: BilanImportPreviewResult['sheetInfo'] = {};

    // Cache des variantes de noms par bassin de classe (feuille = classe)
    const poolVariantsCache = new Map<string, Map<string, any>>();
    const getPoolVariants = (classId: string | null): Map<string, any> => {
      const key = classId || '__ALL__';
      if (!poolVariantsCache.has(key)) {
        const pool = classId ? studentsByClassId.get(classId) || [] : allStudents;
        const variants = new Map<string, any>();
        for (const s of pool) {
          for (const v of buildNameVariants(s.firstName, s.lastName)) {
            if (!variants.has(v)) variants.set(v, s);
          }
        }
        poolVariantsCache.set(key, variants);
      }
      return poolVariantsCache.get(key)!;
    };

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      // Ignorer les feuilles d'instructions / RECAP
      if (sheetName === 'RECAP' || sheetName.startsWith('_') || /instruction/i.test(sheetName)) {
        return;
      }

      // ⭐ Auto-détection du format de la feuille
      const detection = detectSheetFormat(worksheet);
      if (detection.format === 'UNKNOWN') {
        this.logger.warn(
          `Feuille "${sheetName}" : format non reconnu (pas d'en-tête "Noms et Prénoms") — ignorée`,
        );
        return;
      }
      sheetsProcessed.push(sheetName);

      if (detection.format === 'POINT') {
        // ⭐ FORMAT POINT — standard des écoles (1 feuille = 1 classe) OU
        // multi-classes (sections MATERNELLE/CI/CP/... dans une même feuille,
        // tranches P1..P8).
        const parsed = parsePointSheet(worksheet, sheetName, detection);
        sheetInfo[sheetName] = {
          format: 'POINT',
          yearLabel: parsed.yearLabel,
          classFee: parsed.classFee,
          sections: parsed.sections,
        };
        for (const pr of parsed.rows) {
          rows.push({
            rowIndex: pr.rowIndex,
            sheetName,
            className: pr.className,
            studentName: pr.studentName,
            arrear: pr.arrear,
            arrearNote: pr.arrearNote,
            inscription: pr.inscription,
            tranches: pr.tranches,
            total: pr.total,
            format: 'POINT',
            unif: pr.unif,
            tenue: pr.tenue,
            fraisGeneraux: pr.fraisGeneraux,
            scolaritePayee: pr.scolaritePayee,
            reste: pr.reste,
            notes: pr.notes,
            matchStatus: 'NOT_FOUND',
            matchScore: 0,
            errors: [],
            isValid: true,
          });
        }
      } else {
        // FORMAT SIMPLE — template plat Academia (rétrocompatible)
        const parsed = parseSimpleSheet(worksheet, sheetName, detection);
        sheetInfo[sheetName] = { format: 'SIMPLE' };
        for (const sr of parsed) {
          rows.push({
            rowIndex: sr.rowIndex,
            sheetName,
            studentName: sr.studentName,
            arrear: sr.arrear,
            inscription: sr.inscription,
            tranches: sr.tranches,
            total: sr.total,
            format: 'SIMPLE',
            unif: 0,
            tenue: 0,
            fraisGeneraux: sr.inscription,
            scolaritePayee: sr.tranches.reduce((s, v) => s + v, 0),
            reste: 0,
            notes: [],
            matchStatus: 'NOT_FOUND',
            matchScore: 0,
            errors: [],
            isValid: true,
          });
        }
      }
    });

    // ⭐ Résolution des élèves — bassin restreint à la classe :
    //   - format multi-classes → classe de la SECTION (row.className) ;
    //   - format classique → classe portée par le nom de la feuille.
    for (const row of rows) {
      const classId = this.resolveClassId(row.className || row.sheetName, classes);
      const pool = classId ? studentsByClassId.get(classId) || [] : allStudents;
      const poolVariants = getPoolVariants(classId);
      this.validateAndResolveRow(
        row,
        poolVariants,
        pool,
        studentByNameVariants,
        studentByMatricule,
        allStudents,
      );
    }

    // ⭐ Avertissement d'alignement des années (fichier vs année cible)
    let yearMismatch: BilanImportPreviewResult['yearMismatch'] = null;
    const targetCanon = canonicalYearLabel(targetYear?.name || targetYear?.label || '');
    if (targetCanon) {
      const mismatched: Array<{ sheet: string; detected: string }> = [];
      for (const sheet of sheetsProcessed) {
        const info = sheetInfo[sheet];
        if (!info?.yearLabel) continue;
        const detectedCanon = canonicalYearLabel(info.yearLabel);
        if (detectedCanon && detectedCanon !== targetCanon) {
          mismatched.push({ sheet, detected: detectedCanon });
        }
      }
      if (mismatched.length > 0) {
        yearMismatch = { targetYear: targetCanon, sheets: mismatched };
      }
    }

    const validRows = rows.filter((r) => r.isValid).length;
    const invalidRows = rows.length - validRows;

    const summary = {
      totalAmount: rows.filter((r) => r.isValid).reduce((sum, r) => sum + r.total, 0),
      bySheet: {} as Record<string, number>,
      byClass: {} as Record<string, number>,
      studentsMatched: rows.filter((r) => r.isValid && r.matchStatus !== 'NOT_FOUND').length,
      studentsNotFound: rows.filter((r) => r.matchStatus === 'NOT_FOUND').length,
    };
    for (const r of rows.filter((r) => r.isValid)) {
      summary.bySheet[r.sheetName] = (summary.bySheet[r.sheetName] || 0) + r.total;
      // ⭐ Par classe : section si présente, sinon feuille (= classe)
      const classKey = r.className || r.sheetName;
      summary.byClass![classKey] = (summary.byClass![classKey] || 0) + r.total;
    }

    return { totalRows: rows.length, validRows, invalidRows, rows, sheetsProcessed, sheetInfo, yearMismatch, summary };
  }

  // ─── Run (création des transactions) ───────────────────────────────────────

  /**
   * Importe réellement le bilan : crée une FinanceTransaction par élève valide.
   *
   * Pour chaque ligne valide :
   *   1. Garantit l'existence du StudentAccount (via studentAccountService.recalculate)
   *   2. Crée une FinanceTransaction via financeTransactionService.create()
   *      - type = PAYMENT
   *      - amount = total encaissé (POINT : Inscript + Unif + Tenue + P1..P6 ;
   *        SIMPLE : Arriéré + Inscription + Tranches)
   *      - paymentMethod = CASH
   *      - reference = "Import Excel - Bilan Encaissements - {sheetName} - L{rowIndex}"
   *      - cashierId = userId (ou 'excel-import' fallback)
   *   3. Le service crée automatiquement les allocations FIFO sur les AccountBreakdowns
   *      et met à jour les paidAmount + totalPaid + balance.
   */
  async runImport(
    tenantId: string,
    academicYearId: string,
    fileDataUrl: string,
    userId?: string,
  ): Promise<BilanImportRunResult> {
    const preview = await this.previewImport(tenantId, academicYearId, fileDataUrl);
    const validRows = preview.rows.filter((r) => r.isValid);

    // ⭐ IDEMPOTENCE : pré-charger les références DÉJÀ importées pour ce tenant +
    // cette année. Un relancement (double-clic, reconnexion, proxy qui coupe) ne
    // crée JAMAIS de doublon : les lignes déjà importées sont ignorées.
    // (Incident 08/09/2026 : timeout BFF 30 s → relance utilisateur → 2 imports
    // concurrents → 116 transactions en double sur Mon Avenir Plus.)
    const importPrefix = 'Import Excel - Bilan Encaissements - ';
    const existingRefs = new Set(
      (
        await this.prisma.financeTransaction.findMany({
          where: {
            tenantId,
            academicYearId,
            reference: { startsWith: importPrefix },
          },
          select: { reference: true },
        })
      ).map((t) => t.reference),
    );
    if (existingRefs.size > 0) {
      this.logger.warn(
        `Idempotence import bilan : ${existingRefs.size} ligne(s) déjà importée(s) seront ignorée(s)`,
      );
    }

    const results: BilanImportRunResult['results'] = [];
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of validRows) {
      try {
        // Si le total est 0 → skip (rien à encaisser)
        if (row.total <= 0) {
          skipped++;
          results.push({
            rowIndex: row.rowIndex,
            sheetName: row.sheetName,
            studentName: row.studentName,
            success: true,
            amount: 0,
            error: 'Montant total = 0, ignoré',
          });
          continue;
        }

        const studentId = row.resolvedStudentId!;

        // Garantir l'existence du StudentAccount (et des AccountBreakdowns)
        // La méthode recalculate fait get-or-create + recalcule les breakdowns.
        try {
          await this.studentAccountService.recalculate(studentId, tenantId, academicYearId);
        } catch (recalcErr: any) {
          this.logger.warn(
            `Recalcul du compte élève ${studentId} échoué (non bloquant): ${recalcErr.message}`,
          );
        }

        // Récupérer le StudentAccount (unique par studentId + academicYearId)
        const account = await this.prisma.studentAccount.findUnique({
          where: { studentId_academicYearId: { studentId, academicYearId } },
          select: { id: true },
        });
        if (!account) {
          errors++;
          results.push({
            rowIndex: row.rowIndex,
            sheetName: row.sheetName,
            studentName: row.studentName,
            success: false,
            error: 'StudentAccount introuvable après recalcul',
          });
          continue;
        }

        // Référence unique par ligne (préserve le préfixe "Import Excel - Bilan Encaissements")
        // ⭐ Inclut la classe (section) pour les fichiers multi-classes
        const formatTag = row.format === 'POINT' ? ' [POINT]' : '';
        const classTag = row.className || row.sheetName;
        const reference = `Import Excel - Bilan Encaissements - ${classTag} - L${row.rowIndex}${formatTag}`;

        // ⭐ IDEMPOTENCE : ligne déjà importée (même référence) → ignorée.
        // Protège contre les relances concurrentes (timeout proxy, double-clic).
        if (existingRefs.has(reference)) {
          skipped++;
          results.push({
            rowIndex: row.rowIndex,
            sheetName: row.sheetName,
            studentName: row.studentName,
            success: true,
            amount: 0,
            error: 'Déjà importée — ignorée (protection anti-doublon)',
          });
          continue;
        }

        // Créer la FinanceTransaction — le service gère :
        //   - génération receiptNumber unique
        //   - allocations FIFO sur les AccountBreakdowns
        //   - update account_breakdowns.paidAmount + remainingAmount
        //   - update student_account.totalPaid + balance (via trigger)
        //   - ⭐ IMPORT : PAS de reçu PDF ni notification (skipReceiptSideEffects) —
        //     un import de masse historique ne doit pas déclencher 300+ PDF/emails
        //     (lourd, ralentit l'import et notifie les parents de paiements passés)
        const tx = await this.financeTransactionService.create(tenantId, {
          academicYearId,
          studentAccountId: account.id,
          amount: row.total,
          paymentMethod: 'CASH',
          reference,
          cashierId: userId || 'excel-import',
          skipReceiptSideEffects: true,
        });

        imported++;
        results.push({
          rowIndex: row.rowIndex,
          sheetName: row.sheetName,
          studentName: row.studentName,
          success: true,
          transactionId: tx.id,
          amount: row.total,
        });
      } catch (e: any) {
        errors++;
        this.logger.error(
          `Import bilan ligne ${row.rowIndex} (${row.sheetName} / ${row.studentName}): ${e.message}`,
        );
        results.push({
          rowIndex: row.rowIndex,
          sheetName: row.sheetName,
          studentName: row.studentName,
          success: false,
          error: e.message,
        });
      }
    }

    return { total: preview.totalRows, imported, skipped, errors, results };
  }

  // ─── Méthodes privées : template ───────────────────────────────────────────

  private sanitizeSheetName(name: string): string {
    let clean = name.replace(/[\\/?*\[\]:]/g, '-').trim();
    if (clean.length > 31) clean = clean.substring(0, 31);
    return clean || 'Feuille';
  }

  /**
   * ⭐ Applique la mise en page « POINT » (standard des écoles) à une feuille :
   *   Ligne 3 : ANNEE SCOLAIRE {année} + Scolarité (frais annuels à remplir)
   *   Lignes 4-5 : en-têtes fusionnés (N° | Noms et Prénoms | Arriéré | Tél |
   *     Inscript | Unif | Tenue de Sport | Total frais Généraux | Scolarité
   *     P1..P6 | Total Scolarité | Reste | Total des payements)
   *   Données à partir de la ligne 6, pré-remplies avec les élèves de la classe,
   *     formules de totaux, ligne TOTAL en fin de tableau.
   */
  private applyPointSheetLayout(
    worksheet: ExcelJS.Worksheet,
    schoolLevelName: string,
    yearLabel: string,
    studentsInClass: any[],
  ): void {
    // Largeurs de colonnes (A..Q)
    const widths = [5, 32, 12, 12, 10, 10, 12, 12, 10, 10, 10, 10, 10, 10, 13, 11, 14];
    widths.forEach((w, i) => {
      worksheet.getColumn(i + 1).width = w;
    });

    // ── Ligne 3 : année scolaire + frais annuels de la classe ──
    const row3 = worksheet.getRow(3);
    row3.getCell(10).value = 'ANNEE SCOLAIRE ';
    row3.getCell(12).value = yearLabel || '';
    row3.getCell(15).value = 'Scolarité ';
    row3.getCell(16).value = ''; // frais annuels de la classe — à remplir par l'école
    for (const c of [10, 12, 15]) {
      row3.getCell(c).font = { bold: true, size: 11 };
    }

    // ── Lignes 4-5 : en-têtes fusionnés ──
    const headers: Array<[number, number, number, number, string]> = [
      // [rowStart, colStart, rowEnd, colEnd, libellé]
      [4, 1, 5, 1, 'N°'],
      [4, 2, 5, 2, 'Noms et Prénoms'],
      [4, 3, 5, 3, 'Arriéré'],
      [4, 4, 5, 4, 'Tél'],
      [4, 5, 5, 5, 'Inscript'],
      [4, 6, 5, 6, 'Unif'],
      [4, 7, 5, 7, 'Tenue de Sport'],
      [4, 8, 5, 8, 'Total frais Généraux'],
      [4, 9, 4, 14, 'Scolarité'],
      [4, 15, 5, 15, 'Total Scolarité'],
      [4, 16, 5, 16, 'Reste'],
      [4, 17, 5, 17, 'Total des payements'],
    ];
    for (const [r1, c1, r2, c2, label] of headers) {
      if (r1 !== r2 || c1 !== c2) {
        worksheet.mergeCells(r1, c1, r2, c2);
      }
      const cell = worksheet.getRow(r1).getCell(c1);
      cell.value = label;
    }
    // Sous-en-tête des tranches P1..P6 (ligne 5, colonnes I..N)
    for (let i = 0; i < 6; i++) {
      worksheet.getRow(5).getCell(9 + i).value = `P${i + 1}`;
    }

    // Style des en-têtes (lignes 4-5) — bleu marine (couleur finance / bilan)
    for (const r of [4, 5]) {
      const hrow = worksheet.getRow(r);
      hrow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      hrow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      hrow.height = r === 4 ? 24 : 18;
      for (let c = 1; c <= 17; c++) {
        hrow.getCell(c).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' }, // blue-900
        };
      }
    }

    // ── Données à partir de la ligne 6, pré-remplies avec les élèves ──
    const dataStart = 6;
    let r = dataStart;
    if (studentsInClass.length > 0) {
      let n = 1;
      for (const s of studentsInClass) {
        // Format "NOM Prénom" (format Excel classique au Bénin)
        const displayName = `${(s.lastName || '').toUpperCase()} ${s.firstName || ''}`.trim();
        const row = worksheet.getRow(r);
        row.getCell(1).value = n;
        row.getCell(2).value = displayName;
        this.addPointFormulas(worksheet, r);
        row.font = { size: 10, color: { argb: 'FF1F2937' } };
        row.alignment = { vertical: 'middle' };
        n++;
        r++;
      }
    } else {
      // Aucun élève — ligne d'exemple (à supprimer avant import)
      const row = worksheet.getRow(r);
      row.getCell(1).value = 1;
      row.getCell(2).value = 'ADANDE Aïcha';
      row.getCell(5).value = 5000;
      row.getCell(9).value = 10000;
      row.getCell(10).value = 10000;
      this.addPointFormulas(worksheet, r);
      row.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
      r++;
    }
    const dataEnd = r - 1;

    // ── Ligne TOTAL ──
    const totalRow = worksheet.getRow(r);
    totalRow.getCell(2).value = 'TOTAL';
    for (const c of [3, 5, 6, 7, 8, 15, 16, 17]) {
      totalRow.getCell(c).value = { formula: `SUM(${colLetter(c)}${dataStart}:${colLetter(c)}${dataEnd})` };
    }
    for (let i = 0; i < 6; i++) {
      const c = 9 + i;
      totalRow.getCell(c).value = { formula: `SUM(${colLetter(c)}${dataStart}:${colLetter(c)}${dataEnd})` };
    }
    totalRow.font = { bold: true, size: 10 };
    totalRow.getCell(2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFDBEAFE' }, // blue-100
    };

    // ── Bordures de la zone de tableau ──
    for (let i = 4; i <= r; i++) {
      const row = worksheet.getRow(i);
      for (let c = 1; c <= 17; c++) {
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    }

    // ── Instructions sous le tableau ──
    const instructions = [
      `🏫 Feuille de la classe : ${worksheet.name}${schoolLevelName ? ` (${schoolLevelName})` : ''} — ` +
        `${studentsInClass.length} élève(s) pré-rempli(s). Structure identique aux fichiers « POINT » des écoles.`,
      '📋 Noms et Prénoms : format "NOM Prénom" (ex: "ADANDE Aïcha"). Matching insensible aux accents/casse.',
      '💰 Montants en FCFA. Saisissez dans P1..P6 les montants encaissés par tranche de scolarité.',
      '⚠️ Colonne « Arriéré » (année antérieure) : informative — non importée ici (utiliser l\'import des arriérés).',
      '✅ Le Total encaissé importé = Inscript + Unif + Tenue de Sport + P1 + ... + P6 (colonne « Total des payements »).',
      '🔄 Si ce total vaut 0, la ligne est ignorée à l\'import.',
    ];
    let ir = r + 2;
    for (const inst of instructions) {
      const row = worksheet.getRow(ir);
      row.getCell(1).value = inst;
      row.getCell(1).font = { italic: true, color: { argb: 'FF1E3A8A' }, size: 10 };
      ir++;
    }
  }

  /** Formules de calculs automatiques d'une ligne de données POINT. */
  private addPointFormulas(worksheet: ExcelJS.Worksheet, r: number): void {
    const row = worksheet.getRow(r);
    // H = E + F + G (Total frais généraux)
    row.getCell(8).value = { formula: `E${r}+F${r}+G${r}` };
    // O = SUM(I..N) (Total scolarité payée)
    row.getCell(15).value = { formula: `SUM(I${r}:N${r})` };
    // P = frais de classe - O (Reste) — protégé si P3 non rempli
    row.getCell(16).value = { formula: `IF($P$3="","",$P$3-O${r})` };
    // Q = H + O (Total des payements)
    row.getCell(17).value = { formula: `H${r}+O${r}` };
  }

  // ─── Méthodes privées : parsing + validation ───────────────────────────────

  private async parseExcelFile(fileDataUrl: string): Promise<ExcelJS.Workbook> {
    const base64Match = fileDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64Data = base64Match ? base64Match[2] : fileDataUrl;
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  }

  /**
   * ⭐ Résout l'identifiant de classe correspondant au nom d'une feuille.
   * Cascade de tentatives : nom exact → nom sans espaces → nom sans la
   * section (ex: "CP A" → "CP") → code de classe → containment.
   * Retourne null si aucune classe ne correspond (bassin global).
   */
  private resolveClassId(sheetName: string, classes: Array<{ id: string; name?: string; code?: string }>): string | null {
    if (!sheetName) return null;
    const target = normalizeName(sheetName);
    const targetNoSpace = target.replace(/\s/g, '');
    // "CP A" → "cp" (sans la section finale)
    const parts = target.split(' ');
    const targetNoSection = parts.length > 1 ? parts.slice(0, -1).join(' ') : target;

    const classByNorm = new Map<string, string>();
    for (const c of classes) {
      if (c.name) {
        classByNorm.set(normalizeName(c.name), c.id);
        classByNorm.set(normalizeName(c.name).replace(/\s/g, ''), c.id);
      }
      if (c.code) {
        classByNorm.set(normalizeName(c.code), c.id);
        classByNorm.set(normalizeName(c.code).replace(/\s/g, ''), c.id);
      }
    }

    // 1. Nom exact (normalisé) ou sans espaces
    if (classByNorm.has(target)) return classByNorm.get(target)!;
    if (classByNorm.has(targetNoSpace)) return classByNorm.get(targetNoSpace)!;

    // 2. Nom sans la section ("cm2 a" → "cm2")
    if (classByNorm.has(targetNoSection)) return classByNorm.get(targetNoSection)!;

    // 3. Containment : la classe DB commence par le nom de feuille (ou inverse)
    for (const [norm, id] of classByNorm.entries()) {
      if (norm.length >= 2 && (norm.startsWith(target) || target.startsWith(norm))) {
        return id;
      }
    }
    return null;
  }

  /**
   * Valide une ligne : résout l'élève par nom (fuzzy) + valide les montants.
   * ⭐ Le matching priorise le bassin d'élèves de la classe de la feuille
   * (poolVariants / pool), avec repli global si aucun match local.
   */
  private validateAndResolveRow(
    row: BilanImportRow,
    poolVariants: Map<string, any>,
    pool: any[],
    studentByNameVariants: Map<string, any>,
    studentByMatricule: Map<string, any>,
    allStudents: any[],
  ): void {
    // 1. Nom obligatoire
    if (!row.studentName) {
      row.errors.push('Nom de l\'élève manquant');
    }

    // 2. Valider les montants (doivent être >= 0)
    if (row.arrear < 0) row.errors.push('Arriéré ne peut pas être négatif');
    if (row.inscription < 0) row.errors.push('Inscription ne peut pas être négative');
    for (let i = 0; i < row.tranches.length; i++) {
      if (row.tranches[i] < 0) {
        row.errors.push(`Tranche ${i + 1} ne peut pas être négative`);
      }
    }

    // 3. Résoudre l'élève par nom (fuzzy matching)
    if (row.studentName) {
      let matched: any = undefined;

      // a) Match exact par variante normalisée — DANS la classe de la feuille
      const norm = normalizeName(row.studentName);
      matched = poolVariants.get(norm);
      if (matched) {
        row.matchStatus = 'MATCHED';
        row.matchScore = 100;
      }

      // b) Permutation des parties du nom (ex: "NOM Prénom" → "Prénom NOM") — classe puis global
      if (!matched) {
        const parts = row.studentName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          const restName = parts.slice(0, -1).join(' ');
          const reversed = normalizeName(lastPart + ' ' + restName);
          matched = poolVariants.get(reversed) || studentByNameVariants.get(reversed);
          if (matched) {
            row.matchStatus = 'MATCHED';
            row.matchScore = 90;
          }
        }
      }

      // c) Match exact global (élève d'une autre classe)
      if (!matched) {
        matched = studentByNameVariants.get(norm);
        if (matched) {
          row.matchStatus = 'MATCHED';
          row.matchScore = 85;
        }
      }

      // d) Préfixe (matching approximatif) — dans la classe, puis global
      if (!matched) {
        const parts = row.studentName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const possibleLastName = parts[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const possibleFirstName = parts[parts.length - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const searchPools = pool.length > 0 ? [pool, allStudents] : [allStudents];
          for (const searchPool of searchPools) {
            for (const s of searchPool) {
              const dbLN = (s.lastName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const dbFN = (s.firstName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (dbLN.startsWith(possibleLastName) && dbFN.startsWith(possibleFirstName)) {
                matched = s;
                row.matchStatus = 'FUZZY';
                row.matchScore = 70;
                break;
              }
            }
            if (matched) break;
          }
        }
      }

      // e) Par matricule (au cas où le nom serait en fait un matricule)
      if (!matched) {
        const matriculeMatch = studentByMatricule.get(row.studentName.toLowerCase().trim());
        if (matriculeMatch) {
          matched = matriculeMatch;
          row.matchStatus = 'MATCHED';
          row.matchScore = 100;
        }
      }

      if (matched) {
        row.resolvedStudentId = matched.id;
        row.resolvedStudentName = `${matched.lastName} ${matched.firstName}`.trim();
      } else {
        row.matchStatus = 'NOT_FOUND';
        row.matchScore = 0;
        row.errors.push(`Élève "${row.studentName}" introuvable en DB (vérifiez l'orthographe ou saisissez le matricule)`);
      }
    }

    // 4. Si total = 0, la ligne est marquée comme valide mais sera skippée à l'import
    //    (utile pour les élèves qui n'ont rien payé — ils restent dans le fichier mais
    //    ne génèrent pas de transaction)
    if (row.total === 0 && row.errors.length === 0) {
      // Ligne valide mais sans montant — ne pas bloquer l'import
    }

    row.isValid = row.errors.length === 0;
  }
}

/** Lettre de colonne Excel (1 → A, 2 → B, ...). */
function colLetter(col: number): string {
  let s = '';
  let c = col;
  while (c > 0) {
    const mod = (c - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    c = Math.floor((c - mod - 1) / 26);
  }
  return s;
}
