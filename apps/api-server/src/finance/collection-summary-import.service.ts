/**
 * ============================================================================
 * COLLECTION SUMMARY IMPORT SERVICE — Import en masse du bilan des encaissements
 * ============================================================================
 *
 * Permet aux établissements d'importer les paiements encaisses (bilan des
 * encaissements) depuis un fichier Excel (.xlsx), typiquement les fichiers
 * "POINT" remplis manuellement par les comptables des ecoles.
 *
 * Workflow :
 *   1. L'admin telecharge le template (GET /finance/collection-summary/import/template)
 *      -> une feuille par classe, avec les eleves pre-remplis
 *   2. L'admin remplit les colonnes de paiement (Arriere, Inscription, Tranches 1-6)
 *   3. L'admin upload le fichier -> preview (POST /finance/collection-summary/import/preview)
 *   4. L'admin corrige les erreurs et confirme
 *   5. Import reel (POST /finance/collection-summary/import/run)
 *      -> pour chaque ligne valide : cree une FinanceTransaction (type=PAYMENT)
 *         + FinanceTransactionAllocation (allouee FIFO sur les AccountBreakdowns)
 *      -> met a jour account_breakdowns.paidAmount + student_account.totalPaid
 *      -> retourne { imported, skipped, errors, total }
 *
 * Format Excel (une feuille par classe, colonnes) :
 *   Noms et Prenoms | Arriere | Inscription | Tranche 1 | Tranche 2 | ... | Tranche 6 | Total
 *
 * Resolution eleve : matching flou par nom (meme logique que scripts/compare-excel-vs-db.js) :
 *   - normalisation NFD + minuscules + suppression accents
 *   - variantes "firstName lastName" et "lastName firstName"
 *   - suppression des initiales (ex: "BARANON M." -> "BARANON")
 *   - fallback par prefixe si pas de match exact
 * ============================================================================
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FinanceTransactionService } from './finance-transaction.service';
import { StudentAccountService } from './student-account.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { normalizeName, buildNameVariants } from './fee-override-import.service';

// ─── Types publics ───────────────────────────────────────────────────────────

export interface BilanImportRow {
  rowIndex: number;
  sheetName: string; // nom de la feuille (= classe)
  studentName: string; // nom tel que lu dans l'Excel
  arrear: number;
  inscription: number;
  tranches: number[]; // [t1, t2, t3, t4, t5, t6] — 0 si colonne absente
  total: number;
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
  summary: {
    totalAmount: number;
    bySheet: Record<string, number>;
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

// ─── Constantes ──────────────────────────────────────────────────────────────

const MAX_TRANCHES = 6;

@Injectable()
export class CollectionSummaryImportService {
  private readonly logger = new Logger(CollectionSummaryImportService.name);

  // En-têtes du template (colonne 1 = Noms, colonnes 2-9 = montants, colonne 10 = Total)
  private static readonly HEADERS = [
    'Noms et Prénoms',
    'Arriéré',
    'Inscription',
    'Tranche 1',
    'Tranche 2',
    'Tranche 3',
    'Tranche 4',
    'Tranche 5',
    'Tranche 6',
    'Total',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeTransactionService: FinanceTransactionService,
    private readonly studentAccountService: StudentAccountService,
  ) {}

  // ─── Téléchargement du template ────────────────────────────────────────────

  /**
   * Génère et télécharge le template Excel (une feuille par classe).
   * Chaque feuille est pré-remplie avec les élèves de la classe (colonne "Noms")
   * et les colonnes de montants vides à remplir.
   */
  async downloadTemplate(
    tenantId: string,
    academicYearId: string,
    res: Response,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    // Récupérer toutes les classes physiques du tenant
    const classes = await this.prisma.class.findMany({
      where: { tenantId },
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
        status: { in: ['ACTIVE', 'ENROLLED', 'PRE_REGISTERED', 'ADMITTED'] },
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
      this.applySheetLayout(ws, '', []);
      this.addInstructions(ws);
    } else {
      // Une feuille par classe
      for (const cls of classes) {
        const sheetName = this.sanitizeSheetName(cls.name || cls.code || `Classe-${cls.id.substring(0, 8)}`);
        const schoolLevelName = cls.schoolLevel?.name || '';
        const studentsInClass = studentsByClass.get(cls.id) || [];
        const ws = workbook.addWorksheet(sheetName);
        this.applySheetLayout(ws, schoolLevelName, studentsInClass);
        this.addInstructions(ws);
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
   * Pour chaque ligne : matche l'élève par nom (fuzzy), valide les montants.
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
        status: { in: ['ACTIVE', 'ENROLLED', 'PRE_REGISTERED', 'ADMITTED'] },
        student: { status: { not: 'WITHDRAWN' } },
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, matricule: true, studentCode: true },
        },
        class: { select: { id: true, name: true } },
      },
    });

    // Index par variante de nom + par matricule
    const studentByNameVariants = new Map<string, any>();
    const studentByMatricule = new Map<string, any>();
    const allStudents: any[] = [];
    for (const e of enrollments) {
      const s = e.student;
      allStudents.push({ ...s, className: e.class?.name || '' });
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

    const rows: BilanImportRow[] = [];
    const sheetsProcessed: string[] = [];

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      // Ignorer les feuilles d'instructions / RECAP
      if (sheetName === 'RECAP' || sheetName.startsWith('_') || /instruction/i.test(sheetName)) {
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
        // Skip lignes d'instructions / totaux
        const firstStr = typeof firstCell === 'string' ? firstCell.trim() : String(firstCell).trim();
        if (!firstStr || firstStr === 'Noms et Prénoms' || firstStr === 'Noms et Prenoms') return;
        if (/^[⚠️📅💰✅📊🧑📋💡🏫🔄📝]/.test(firstStr)) return;
        if (firstStr.toUpperCase().includes('TOTAL')) return;

        const parsed = this.parseRow(row, rowNumber, sheetName);
        this.validateAndResolveRow(parsed, studentByNameVariants, studentByMatricule, allStudents, sheetName);
        rows.push(parsed);
      });
    });

    const validRows = rows.filter((r) => r.isValid).length;
    const invalidRows = rows.length - validRows;

    const summary = {
      totalAmount: rows.filter((r) => r.isValid).reduce((sum, r) => sum + r.total, 0),
      bySheet: {} as Record<string, number>,
      studentsMatched: rows.filter((r) => r.isValid && r.matchStatus !== 'NOT_FOUND').length,
      studentsNotFound: rows.filter((r) => r.matchStatus === 'NOT_FOUND').length,
    };
    for (const r of rows.filter((r) => r.isValid)) {
      summary.bySheet[r.sheetName] = (summary.bySheet[r.sheetName] || 0) + r.total;
    }

    return { totalRows: rows.length, validRows, invalidRows, rows, sheetsProcessed, summary };
  }

  // ─── Run (création des transactions) ───────────────────────────────────────

  /**
   * Importe réellement le bilan : crée une FinanceTransaction par élève valide.
   *
   * Pour chaque ligne valide :
   *   1. Garantit l'existence du StudentAccount (via studentAccountService.recalculate)
   *   2. Crée une FinanceTransaction via financeTransactionService.create()
   *      - type = PAYMENT
   *      - amount = somme des colonnes (arriéré + inscription + tranches)
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
        const reference = `Import Excel - Bilan Encaissements - ${row.sheetName} - L${row.rowIndex}`;

        // Créer la FinanceTransaction — le service gère :
        //   - génération receiptNumber unique
        //   - allocations FIFO sur les AccountBreakdowns
        //   - update account_breakdowns.paidAmount + remainingAmount
        //   - update student_account.totalPaid + balance (via trigger)
        //   - génération reçu PDF + notifications (fire-and-forget)
        const tx = await this.financeTransactionService.create(tenantId, {
          academicYearId,
          studentAccountId: account.id,
          amount: row.total,
          paymentMethod: 'CASH',
          reference,
          cashierId: userId || 'excel-import',
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

  private applySheetLayout(
    worksheet: ExcelJS.Worksheet,
    schoolLevelName: string,
    studentsInClass: any[],
  ): void {
    worksheet.columns = CollectionSummaryImportService.HEADERS.map((header) => ({
      header,
      key: header,
      width: header === 'Noms et Prénoms' ? 32 : 14,
    }));

    // Style en-tête — bleu marine (couleur finance / bilan)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // blue-900
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 30;

    // Pré-remplir avec les élèves de la classe (colonne "Noms et Prénoms" = "NOM Prénom")
    let rowIdx = 2;
    if (studentsInClass.length > 0) {
      for (const s of studentsInClass) {
        // Format "NOM Prénom" (format Excel classique au Bénin)
        const displayName = `${(s.lastName || '').toUpperCase()} ${s.firstName || ''}`.trim();
        worksheet.addRow([
          displayName,
          '', // Arriéré
          '', // Inscription
          '', '', '', '', '', '', // Tranches 1-6
          '', // Total
        ]);
        rowIdx++;
      }
    } else {
      // Aucun élève — ligne d'exemple
      worksheet.addRow(['ADANDE Aïcha', 5000, 5000, 10000, 10000, 0, 0, 0, 0, 30000]);
      rowIdx++;
    }

    // Style des lignes de données
    const startRow = 2;
    const endRow = rowIdx - 1;
    for (let i = startRow; i <= endRow; i++) {
      const row = worksheet.getRow(i);
      row.font = studentsInClass.length > 0
        ? { size: 10, color: { argb: 'FF1F2937' } }
        : { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
      row.alignment = { vertical: 'middle' };
    }

    // Bordures
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

    // Note en haut de feuille
    const noteRow = worksheet.addRow([
      `🏫 Feuille pour la classe : ${worksheet.name}${schoolLevelName ? ` (${schoolLevelName})` : ''} — ` +
      `${studentsInClass.length} élève(s) pré-rempli(s). Saisissez les montants encaissés par élève.`,
    ]);
    noteRow.font = { italic: true, color: { argb: 'FF1E3A8A' }, size: 10 };
  }

  private addInstructions(worksheet: ExcelJS.Worksheet): void {
    worksheet.addRow([]);
    const instructions = [
      '⚠️ Lignes d\'exemple à supprimer avant import. Les lignes pré-remplies avec des élèves réels peuvent être conservées.',
      '📋 Noms et Prénoms : format "NOM Prénom" (ex: "ADANDE Aïcha"). Matching insensible aux accents/casse.',
      '💰 Montants en FCFA. Laissez vide ou 0 si aucune paiement pour la colonne.',
      '✅ Total = Arriéré + Inscription + Tranche 1 + ... + Tranche 6 (calculé automatiquement par Excel si formule).',
      '🔄 Si Total = 0, la ligne est ignorée à l\'import.',
      '🏦 Pour chaque ligne valide : une FinanceTransaction (type=PAYMENT) est créée et allouée FIFO sur les AccountBreakdowns.',
      '📝 La référence de transaction sera "Import Excel - Bilan Encaissements - {classe} - L{ligne}".',
    ];
    for (const inst of instructions) {
      worksheet.addRow([inst]);
    }
    const lastRow = worksheet.rowCount;
    for (let i = lastRow - instructions.length + 1; i <= lastRow; i++) {
      const row = worksheet.getRow(i);
      row.font = { italic: true, color: { argb: 'FF1E3A8A' }, size: 10 };
    }
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

  private parseRow(row: ExcelJS.Row, rowNumber: number, sheetName: string): BilanImportRow {
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
      if (!s) return 0;
      const cleaned = s.replace(/[^\d.-]/g, '');
      return cleaned ? Number(cleaned) : 0;
    };

    // Colonnes : 1=Noms, 2=Arriéré, 3=Inscription, 4-9=Tranches 1-6, 10=Total
    const tranches: number[] = [];
    for (let i = 0; i < MAX_TRANCHES; i++) {
      tranches.push(parseAmount(getCell(4 + i)));
    }
    const arrear = parseAmount(getCell(2));
    const inscription = parseAmount(getCell(3));
    const totalFromCell = parseAmount(getCell(10));
    // Si le Total est vide, on le calcule
    const computedTotal = arrear + inscription + tranches.reduce((s, v) => s + v, 0);
    const total = totalFromCell > 0 ? totalFromCell : computedTotal;

    return {
      rowIndex: rowNumber,
      sheetName,
      studentName: getCell(1),
      arrear,
      inscription,
      tranches,
      total,
      matchStatus: 'NOT_FOUND',
      matchScore: 0,
      errors: [],
      isValid: true,
    };
  }

  /**
   * Valide une ligne : résout l'élève par nom (fuzzy) + valide les montants.
   */
  private validateAndResolveRow(
    row: BilanImportRow,
    studentByNameVariants: Map<string, any>,
    studentByMatricule: Map<string, any>,
    allStudents: any[],
    _sheetName: string,
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
      // D'abord : match exact par variante normalisée
      const norm = normalizeName(row.studentName);
      let matched = studentByNameVariants.get(norm);

      if (matched) {
        row.matchStatus = 'MATCHED';
        row.matchScore = 100;
      } else {
        // Essayer en permutant les parties du nom (ex: "NOM Prénom" → "Prénom NOM")
        const parts = row.studentName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const lastPart = parts[parts.length - 1];
          const restName = parts.slice(0, -1).join(' ');
          const reversed = normalizeName(lastPart + ' ' + restName);
          matched = studentByNameVariants.get(reversed);
          if (matched) {
            row.matchStatus = 'MATCHED';
            row.matchScore = 90;
          }
        }
      }

      // Si toujours pas trouvé : essayer par préfixe (matching approximatif)
      if (!matched) {
        const parts = row.studentName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const possibleLastName = parts[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const possibleFirstName = parts[parts.length - 1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          for (const s of allStudents) {
            const dbLN = (s.lastName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const dbFN = (s.firstName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (dbLN.startsWith(possibleLastName) && dbFN.startsWith(possibleFirstName)) {
              matched = s;
              row.matchStatus = 'FUZZY';
              row.matchScore = 70;
              break;
            }
          }
        }
      }

      // Si toujours pas trouvé : essayer par matricule (au cas où le nom soit en fait un matricule)
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
