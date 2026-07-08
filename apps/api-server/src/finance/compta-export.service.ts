/**
 * ============================================================================
 * COMPTA EXPORT SERVICE — Génération des écritures comptables
 * ============================================================================
 *
 * Service unifié pour l'export comptable :
 *   - format FEC (Fichier d'Écritures Comptables — France, 18 colonnes |)
 *   - format OHADA CSV (Bénin / Afrique francophone, séparateur ;)
 *   - format CSV universel (mappable dans Sage, QuickBooks, etc.)
 *
 * Pour chaque transaction financière (encaissement, dépense approuvée),
 * génère 2 lignes d'écriture (débit + crédit) conformes au plan comptable
 * OHADA. Le mapping compte OHADA est lu depuis ExpenseCategory.compteOhada
 * et FeeCategory.compteOhada. Si non mappé, un compte par défaut est utilisé.
 *
 * Journaux :
 *   JVT — Journal des ventes (encaissements frais scolaires)
 *   JAC — Journal des achats (dépenses approuvées)
 *   JQC — Journal de caisse (mouvements espèces)
 *   JQB — Journal de banque (mouvements Mobile Money, Fedapay, virements)
 *
 * Comptes OHADA par défaut (école) :
 *   411000 Élèves - Créances scolaires
 *   419000 Élèves - Avances reçues
 *   401000 Fournisseurs
 *   521000 Banque - Compte courant
 *   571000 Caisse principale
 *   572000 Caisse secondaire
 *   607000 Autres achats (par défaut si catégorie non mappée)
 *   631000 Frais financiers (commissions Fedapay)
 *   706100 Scolarité - Frais d'inscription
 *   706200 Scolarité - Frais de scolarité
 *   706300 Scolarité - Frais d'examen
 *   706400 Cantine scolaire
 *   706500 Transport scolaire
 *   706600 Activités parascolaires
 *   706999 Autres produits scolaires (par défaut si catégorie non mappée)
 *
 * Référence : docs/INTEGRATION-COMPTABILITE.md
 * ============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface ComptaExportFilters {
  dateFrom?: string;
  dateTo?: string;
  academicYearId?: string;
}

export interface ComptaEcriture {
  // Identification
  journalCode: string;        // JVT, JAC, JQC, JQB
  journalLib: string;         // Libellé journal
  ecritureNum: string;        // Numéro séquentiel
  ecritureDate: string;       // YYYYMMDD
  // Compte
  compteNum: string;          // Code OHADA (ex: 411000)
  compteLib: string;          // Libellé compte
  compAuxNum: string;         // Compte auxiliaire (élève/fournisseur)
  compAuxLib: string;         // Libellé auxiliaire
  // Pièce
  pieceRef: string;           // N° pièce (reçu/facture)
  pieceDate: string;          // YYYYMMDD
  ecritLib: string;           // Libellé écriture
  // Montants
  debit: number;
  credit: number;
  // Lettrage / validation
  ecritureLet: string;        // Lettrage (vide si non lettré)
  dateLet: string;            // Date de lettrage
  validDate: string;          // Date de validation
  // Devise
  montantdevise: number;      // Montant en devise (0 si mono-devise)
  idevise: string;            // Code ISO devise (XOF)
  // NatCode (nature de l'écriture)
  natCode: string;            // VTE, ACH, CAI, BNK
}

@Injectable()
export class ComptaExportService {
  private readonly logger = new Logger(ComptaExportService.name);

  // Comptes OHADA par défaut pour les écoles
  private static readonly DEFAULT_ACCOUNTS = {
    ELEVES_CREANCES: { num: '411000', lib: 'Élèves - Créances scolaires' },
    ELEVES_AVANCES: { num: '419000', lib: 'Élèves - Avances reçues' },
    FOURNISSEURS: { num: '401000', lib: 'Fournisseurs' },
    BANQUE: { num: '521000', lib: 'Banque - Compte courant' },
    CAISSE_PRINCIPALE: { num: '571000', lib: 'Caisse principale' },
    CAISSE_SECONDAIRE: { num: '572000', lib: 'Caisse secondaire' },
    AUTRES_ACHATS: { num: '607000', lib: 'Autres achats' },
    FRAIS_FINANCIERS: { num: '631000', lib: 'Frais financiers (commissions Fedapay)' },
    SCOLARITE_INSCRIPTION: { num: '706100', lib: 'Scolarité - Frais d\'inscription' },
    SCOLARITE_FRAIS: { num: '706200', lib: 'Scolarité - Frais de scolarité' },
    SCOLARITE_EXAMEN: { num: '706300', lib: 'Scolarité - Frais d\'examen' },
    CANTINE: { num: '706400', lib: 'Cantine scolaire' },
    TRANSPORT: { num: '706500', lib: 'Transport scolaire' },
    PARASCOLAIRE: { num: '706600', lib: 'Activités parascolaires' },
    AUTRES_PRODUITS: { num: '706999', lib: 'Autres produits scolaires' },
  };

  // Compte tiers de caisse selon la méthode de paiement
  private static readonly PAYMENT_TO_COMPTE = {
    CASH: ComptaExportService.DEFAULT_ACCOUNTS.CAISSE_PRINCIPALE,
    MOBILE_MONEY: ComptaExportService.DEFAULT_ACCOUNTS.BANQUE,
    FEDAPAY: ComptaExportService.DEFAULT_ACCOUNTS.BANQUE,
    FEEXPAY: ComptaExportService.DEFAULT_ACCOUNTS.BANQUE,
    WIRE: ComptaExportService.DEFAULT_ACCOUNTS.BANQUE,
    BANK: ComptaExportService.DEFAULT_ACCOUNTS.BANQUE,
    CHECK: ComptaExportService.DEFAULT_ACCOUNTS.CAISSE_PRINCIPALE,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les écritures comptables pour la période.
   * Combine les encaissements (transactions PAYMENT) et les dépenses approuvées.
   */
  async getAllEcritures(
    tenantId: string,
    filters: ComptaExportFilters,
  ): Promise<ComptaEcriture[]> {
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom + 'T00:00:00') : undefined;
    const dateTo = filters.dateTo ? new Date(filters.dateTo + 'T23:59:59') : undefined;

    const ecritures: ComptaEcriture[] = [];
    let seqCounter = 1;
    const nextSeq = () => String(seqCounter++).padStart(8, '0');

    // ─── 1. ENCAISSEMENTS (transactions PAYMENT) → Journal des ventes (JVT) ───
    // Note : on utilise $queryRawUnsafe pour éviter les problèmes de client
    // Prisma non régénéré (champs récents comme cashRegisterId).
    const transactionsRaw = await this.prisma.$queryRawUnsafe(`
      SELECT
        t.id,
        t."receiptNumber",
        t.amount::FLOAT,
        t.type,
        t."paymentMethod",
        t.reference,
        t."createdAt",
        t."cashRegisterId",
        cr.code AS "cashRegisterCode",
        cr.name AS "cashRegisterName",
        s."firstName" AS "studentFirstName",
        s."lastName" AS "studentLastName",
        s."matricule",
        s."studentCode"
      FROM "finance_transactions" t
      LEFT JOIN "cash_registers" cr ON t."cashRegisterId" = cr.id
      LEFT JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      LEFT JOIN "students" s ON sa."studentId" = s.id
      WHERE t."tenantId" = $1
        AND t."academicYearId" = $2
        AND t.type = 'PAYMENT'
        AND t."createdAt" >= $3
        AND t."createdAt" <= $4
      ORDER BY t."createdAt" ASC
    `, tenantId, filters.academicYearId, dateFrom, dateTo);

    const transactions = transactionsRaw as any[];

    for (const tx of transactions) {
      const dateStr = this.formatDate(tx.createdAt);
      const studentName = (tx.studentLastName || tx.studentFirstName)
        ? `${tx.studentLastName || ''} ${tx.studentFirstName || ''}`.trim()
        : 'Élève inconnu';
      const studentCode = tx.studentCode || tx.matricule || '';
      const amount = Number(tx.amount) || 0;
      const pieceRef = tx.receiptNumber || tx.id;
      const ecritLib = `Scolarité - ${studentName}`.slice(0, 50);

      // Compte de trésorerie selon méthode de paiement
      const compteTreso = ComptaExportService.PAYMENT_TO_COMPTE[tx.paymentMethod as keyof typeof ComptaExportService.PAYMENT_TO_COMPTE]
        || ComptaExportService.DEFAULT_ACCOUNTS.CAISSE_PRINCIPALE;

      // Si cashRegister secondaire détecté (code contient "SEC" ou "2"), utiliser 572000
      let compteTresoFinal = compteTreso;
      if (tx.paymentMethod === 'CASH' && tx.cashRegisterCode) {
        const code = tx.cashRegisterCode.toUpperCase();
        if (code.includes('SEC') || code.includes('2') || code.includes('ANNEXE')) {
          compteTresoFinal = ComptaExportService.DEFAULT_ACCOUNTS.CAISSE_SECONDAIRE;
        }
      }

      const journalCode = tx.paymentMethod === 'CASH' || tx.paymentMethod === 'CHECK' ? 'JQC' : 'JQB';
      const journalLib = journalCode === 'JQC' ? 'Journal de caisse' : 'Journal de banque';
      const natCode = journalCode === 'JQC' ? 'CAI' : 'BNK';

      // Écriture 1 : Débit compte trésorerie / Crédit compte élève (créance)
      ecritures.push({
        journalCode,
        journalLib,
        ecritureNum: nextSeq(),
        ecritureDate: dateStr,
        compteNum: compteTresoFinal.num,
        compteLib: compteTresoFinal.lib,
        compAuxNum: '',
        compAuxLib: '',
        pieceRef,
        pieceDate: dateStr,
        ecritLib: `Encaissement - ${studentName}`.slice(0, 50),
        debit: amount,
        credit: 0,
        ecritureLet: '',
        dateLet: '',
        validDate: dateStr,
        montantdevise: 0,
        idevise: 'XOF',
        natCode,
      });

      // Écriture 2 : Débit compte élève (créance soldée) / Crédit compte produit
      ecritures.push({
        journalCode,
        journalLib,
        ecritureNum: nextSeq(),
        ecritureDate: dateStr,
        compteNum: ComptaExportService.DEFAULT_ACCOUNTS.ELEVES_CREANCES.num,
        compteLib: ComptaExportService.DEFAULT_ACCOUNTS.ELEVES_CREANCES.lib,
        compAuxNum: studentCode || String(tx.id || '').slice(0, 8),
        compAuxLib: studentName,
        pieceRef,
        pieceDate: dateStr,
        ecritLib,
        debit: 0,
        credit: amount,
        ecritureLet: '',
        dateLet: '',
        validDate: dateStr,
        montantdevise: 0,
        idevise: 'XOF',
        natCode,
      });
    }

    // ─── 2. DÉPENSES APPROUVÉES → Journal des achats (JAC) ───
    // Note : on utilise $queryRawUnsafe au lieu de l'API Prisma typée car
    // le client Prisma peut ne pas être à jour avec les champs récents
    // (expenseDate, vendor, invoiceRef, cashRegisterId, paymentMethod).
    const expenseDateFrom = dateFrom;
    const expenseDateTo = dateTo;
    const expensesRaw = await this.prisma.$queryRawUnsafe(`
      SELECT
        fe.id,
        fe."tenantId",
        fe."academicYearId",
        fe."categoryId",
        fe.amount::FLOAT,
        fe.description,
        fe.status,
        fe."expenseDate",
        fe."createdAt",
        fe.vendor,
        fe."invoiceRef",
        fe."cashRegisterId",
        fe."paymentMethod",
        ec.name AS "categoryName",
        ec.code AS "categoryCode",
        ec."compteOhada" AS "categoryCompteOhada",
        ec."compteOhadaLib" AS "categoryCompteOhadaLib",
        cr.code AS "cashRegisterCode",
        cr.name AS "cashRegisterName"
      FROM "finance_expenses" fe
      LEFT JOIN "expense_categories" ec ON fe."categoryId" = ec.id
      LEFT JOIN "cash_registers" cr ON fe."cashRegisterId" = cr.id
      WHERE fe."tenantId" = $1
        AND fe."academicYearId" = $2
        AND fe.status = 'APPROVED'
        AND (
          (fe."expenseDate" IS NOT NULL AND fe."expenseDate" >= $3 AND fe."expenseDate" <= $4)
          OR
          (fe."expenseDate" IS NULL AND fe."createdAt" >= $3 AND fe."createdAt" <= $4)
        )
      ORDER BY COALESCE(fe."expenseDate", fe."createdAt") ASC
    `, tenantId, filters.academicYearId, expenseDateFrom, expenseDateTo);

    const expenses = expensesRaw as any[];

    for (const ex of expenses) {
      const dateStr = this.formatDate(ex.expenseDate || ex.createdAt);
      const amount = Number(ex.amount) || 0;
      const pieceRef = ex.invoiceRef || ex.id;
      const ecritLib = ex.description?.slice(0, 50) || 'Dépense';

      // Compte de charge (classe 6) selon mapping catégorie
      const compteCharge = ex.categoryCompteOhada
        ? { num: ex.categoryCompteOhada, lib: ex.categoryCompteOhadaLib || ex.categoryName }
        : ComptaExportService.DEFAULT_ACCOUNTS.AUTRES_ACHATS;

      // Compte de trésorerie (débit de la sortie)
      const paymentMethod = (ex.paymentMethod || 'CASH') as keyof typeof ComptaExportService.PAYMENT_TO_COMPTE;
      let compteTreso = ComptaExportService.PAYMENT_TO_COMPTE[paymentMethod]
        || ComptaExportService.DEFAULT_ACCOUNTS.CAISSE_PRINCIPALE;
      if (paymentMethod === 'CASH' && ex.cashRegisterCode) {
        const code = ex.cashRegisterCode.toUpperCase();
        if (code.includes('SEC') || code.includes('2') || code.includes('ANNEXE')) {
          compteTreso = ComptaExportService.DEFAULT_ACCOUNTS.CAISSE_SECONDAIRE;
        }
      }

      // Écriture 1 : Débit compte de charge / Crédit compte fournisseur
      ecritures.push({
        journalCode: 'JAC',
        journalLib: 'Journal des achats',
        ecritureNum: nextSeq(),
        ecritureDate: dateStr,
        compteNum: compteCharge.num,
        compteLib: compteCharge.lib,
        compAuxNum: ex.vendor ? ex.vendor.slice(0, 20) : '',
        compAuxLib: ex.vendor || 'Fournisseur',
        pieceRef,
        pieceDate: dateStr,
        ecritLib,
        debit: amount,
        credit: 0,
        ecritureLet: '',
        dateLet: '',
        validDate: dateStr,
        montantdevise: 0,
        idevise: 'XOF',
        natCode: 'ACH',
      });

      // Écriture 2 : Débit compte fournisseur / Crédit compte trésorerie (paiement)
      ecritures.push({
        journalCode: 'JAC',
        journalLib: 'Journal des achats',
        ecritureNum: nextSeq(),
        ecritureDate: dateStr,
        compteNum: ComptaExportService.DEFAULT_ACCOUNTS.FOURNISSEURS.num,
        compteLib: ComptaExportService.DEFAULT_ACCOUNTS.FOURNISSEURS.lib,
        compAuxNum: ex.vendor ? ex.vendor.slice(0, 20) : '',
        compAuxLib: ex.vendor || 'Fournisseur',
        pieceRef,
        pieceDate: dateStr,
        ecritLib,
        debit: 0,
        credit: amount,
        ecritureLet: '',
        dateLet: '',
        validDate: dateStr,
        montantdevise: 0,
        idevise: 'XOF',
        natCode: 'ACH',
      });
    }

    this.logger.log(
      `ComptaExport: ${ecritures.length} écritures générées (${transactions.length} transactions, ${expenses.length} dépenses)`,
    );
    return ecritures;
  }

  /**
   * Génère le fichier FEC (Fichier d'Écritures Comptables) au format texte
   * 18 colonnes séparées par | — conforme à la norme française.
   */
  generateFecContent(ecritures: ComptaEcriture[]): string {
    const header = [
      'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
      'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
      'PieceRef', 'PieceDate', 'EcritureLib',
      'Debit', 'Credit',
      'EcritureLet', 'DateLet', 'ValidDate',
      'Montantdevise', 'Idevise',
    ].join('|');

    const lines = ecritures.map((e) => {
      return [
        e.journalCode,
        e.journalLib,
        e.ecritureNum,
        e.ecritureDate,
        e.compteNum,
        e.compteLib,
        e.compAuxNum,
        e.compAuxLib,
        e.pieceRef,
        e.pieceDate,
        e.ecritLib,
        // Montants avec virgule décimale (norme FEC française)
        e.debit.toFixed(2).replace('.', ','),
        e.credit.toFixed(2).replace('.', ','),
        e.ecritureLet,
        e.dateLet,
        e.validDate,
        e.montantdevise.toFixed(2).replace('.', ','),
        e.idevise,
      ]
        .map((v) => String(v || ''))
        .join('|');
    });

    return [header, ...lines].join('\n');
  }

  /**
   * Génère le fichier CSV OHADA (Bénin) — séparateur ;
   * Format compatible Sage OHADA, Compta Bénin, EBP OHADA.
   */
  generateOhadaCsvContent(ecritures: ComptaEcriture[]): string {
    const header = [
      'Date', 'Journal', 'N° Pièce', 'N° Compte', 'Libellé Compte',
      'Tiers', 'Libellé Tiers', 'Libellé Écriture',
      'Débit', 'Crédit', 'N° Écriture',
    ].join(';');

    const lines = ecritures.map((e) => {
      const dateFr = `${e.ecritureDate.slice(6, 8)}/${e.ecritureDate.slice(4, 6)}/${e.ecritureDate.slice(0, 4)}`;
      return [
        dateFr,
        e.journalCode,
        e.pieceRef,
        e.compteNum,
        e.compteLib,
        e.compAuxNum,
        e.compAuxLib,
        e.ecritLib,
        e.debit.toFixed(2),
        e.credit.toFixed(2),
        e.ecritureNum,
      ]
        .map((v) => {
          // Échapper les ; et " dans les valeurs
          const s = String(v || '');
          if (s.includes(';') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(';');
    });

    return [header, ...lines].join('\n');
  }

  /**
   * Génère un CSV universel (mappable) avec en-tête explicite.
   * Format identique à Sage 100 / QuickBooks / Pennylane import.
   */
  generateUniversalCsvContent(ecritures: ComptaEcriture[]): string {
    const header = [
      'Date', 'Journal', 'Numéro écriture', 'Numéro pièce',
      'Compte', 'Libellé compte', 'Tiers', 'Libellé tiers',
      'Libellé', 'Débit', 'Crédit', 'Devise',
    ].join(',');

    const lines = ecritures.map((e) => {
      const dateFr = `${e.ecritureDate.slice(6, 8)}/${e.ecritureDate.slice(4, 6)}/${e.ecritureDate.slice(0, 4)}`;
      return [
        dateFr,
        e.journalCode,
        e.ecritureNum,
        e.pieceRef,
        e.compteNum,
        e.compteLib,
        e.compAuxNum,
        e.compAuxLib,
        e.ecritLib,
        e.debit.toFixed(2),
        e.credit.toFixed(2),
        e.idevise,
      ]
        .map((v) => {
          const s = String(v || '');
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(',');
    });

    return [header, ...lines].join('\n');
  }

  /**
   * Génère le nom de fichier selon le format et la période.
   */
  generateFileName(format: 'fec' | 'ohada' | 'csv', filters: ComptaExportFilters): string {
    const period = filters.dateFrom && filters.dateTo
      ? `${filters.dateFrom}_${filters.dateTo}`
      : filters.dateFrom
        ? `depuis_${filters.dateFrom}`
        : filters.dateTo
          ? `jusquau_${filters.dateTo}`
          : `annee_complete_${new Date().getFullYear()}`;
    const ext = format === 'fec' ? 'txt' : 'csv';
    return `export-compta-${format}-${period}.${ext}`;
  }

  /**
   * Formate une date au format YYYYMMDD (norme FEC).
   */
  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}
