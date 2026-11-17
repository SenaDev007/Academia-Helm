/**
 * ============================================================================
 * FINANCE SERVICE - API Client pour le module Finance
 * ============================================================================
 * Pattern identique au module Pédagogie : routes BFF relatives (financeFetch)
 * au lieu d'appels axios cross-origin (apiFetch).
 * ============================================================================
 */

import { financeFetch } from '@/lib/finance/finance-fetch';

class FinanceService {
  // --- Fee Structures ---
  async getFeeStructures(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/fee-structures${qs ? `?${qs}` : ''}`);
  }

  async createFeeStructure(data: any): Promise<any> {
    return financeFetch('/api/finance/fee-structures', { method: 'POST', body: data });
  }

  async updateFeeStructure(id: string, data: any): Promise<any> {
    return financeFetch(`/api/finance/fee-structures/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
  }

  async deleteFeeStructure(id: string): Promise<any> {
    return financeFetch(`/api/finance/fee-structures/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /**
   * ⭐ Task 24 : Suppression multiple (bulk delete) de fee structures.
   * @param ids Tableau d'IDs à supprimer
   * @returns { deleted: string[], blocked: { id, name, reason }[], message }
   */
  async bulkDeleteFeeStructures(ids: string[]): Promise<any> {
    return financeFetch('/api/finance/fee-structures/bulk-delete', {
      method: 'POST',
      body: { ids },
    });
  }

  async copyFeeStructuresToYear(data: any): Promise<any> {
    return financeFetch('/api/finance/fee-structures/copy-to-year', { method: 'POST', body: data });
  }

  async overrideFeeStructure(data: any): Promise<any> {
    return financeFetch('/api/finance/fee-structures/override', { method: 'POST', body: data });
  }

  async getFeeStructureOverrides(studentId: string, academicYearId?: string): Promise<any> {
    const qs = new URLSearchParams({ studentId });
    if (academicYearId) qs.set('academicYearId', academicYearId);
    return financeFetch(`/api/finance/fee-structures/overrides?${qs}`);
  }

  /**
   * Liste tous les overrides d'un tenant (onglet Personnalisations).
   * Filtres optionnels : academicYearId, classId, feeStructureId.
   */
  async getAllFeeOverrides(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/fee-structures/overrides${qs ? `?${qs}` : ''}`);
  }

  /**
   * Supprime un override existant.
   */
  async deleteFeeOverride(id: string): Promise<any> {
    return financeFetch(`/api/finance/fee-structures/overrides/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /**
   * ⭐ Bulk delete : supprime plusieurs overrides en une seule opération.
   * @param ids Tableau d'IDs d'overrides à supprimer
   * @returns { deleted: string[], blocked: { id, reason }[], message }
   */
  async bulkDeleteFeeOverrides(ids: string[]): Promise<any> {
    return financeFetch('/api/finance/fee-structures/overrides/bulk-delete', {
      method: 'POST',
      body: { ids },
    });
  }

  /**
   * Modifie un override existant (montant personnalisé + motif).
   */
  async updateFeeOverride(id: string, data: { customAmount?: number; reason?: string }): Promise<any> {
    return financeFetch(`/api/finance/fee-structures/overrides/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
  }

  /**
   * ⭐ PERSONNALISATION EN MASSE POUR TOUTE UNE CLASSE (exigence sept. 2026).
   * Applique une réduction (%) ou un montant (XOF) à TOUS les élèves actifs
   * d'une classe pour le frais concerné — upsert par élève + recalcul synchrone.
   * @returns { totalStudents, applied, failed, customAmount, originalAmount, details[] }
   */
  async bulkClassOverride(data: {
    classId: string;
    feeStructureId: string;
    reductionPercent?: number;
    reductionAmount?: number;
    reason: string;
  }): Promise<any> {
    return financeFetch('/api/finance/fee-structures/overrides/bulk-class', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * ⭐ ONGLET « FRAIS GÉNÉRAUX » — listing par élève (dus / payé / solde).
   * Structure identique à Comptes élèves : pagination serveur + KPIs globaux.
   * @returns { data: rows[], total, page, limit, totalPages, sums: { due, paid, remaining, studentsWithGeneralFees } }
   */
  async getGeneralFeeAccounts(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/student-accounts/general-fees${qs ? `?${qs}` : ''}`);
  }

  /**
   * ⭐ ONGLET « FRAIS DES EXAMENS » (oct. 2026) — même endpoint que les frais
   * généraux avec feeType=EXAMEN + examType=CEP|BEPC|BAC|CAP (sous-onglet par
   * examen national : le backend restreint aux classes à examen correspondantes
   * — CM2 / 3ème / Terminale / CAP). Pagination serveur + KPIs globaux.
   */
  async getExamFeeAccounts(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/student-accounts/general-fees${qs ? `?${qs}` : ''}`);
  }

  // --- Student Accounts ---
  async getStudentAccounts(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/student-accounts${qs ? `?${qs}` : ''}`);
  }

  async getStudentAccountDetails(id: string): Promise<any> {
    return financeFetch(`/api/finance/student-accounts/${encodeURIComponent(id)}`);
  }

  /**
   * ⭐ FLUX POST-INSCRIPTION : récupère (ou crée) le compte financier d'un élève
   * précis pour une année — utilisé par le modal de paiement préréglé après
   * l'inscription d'un nouvel élève (le compte existe déjà grâce à admit()).
   * Backend : GET /finance/accounts/student/:studentId (getOrCreate).
   */
  async getStudentAccountByStudentId(studentId: string, academicYearId: string): Promise<any> {
    return financeFetch(
      `/api/finance/student-accounts/student/${encodeURIComponent(studentId)}?academicYearId=${encodeURIComponent(academicYearId)}`,
    );
  }

  async unblockStudentAccount(id: string, data: { reason: string }): Promise<any> {
    return financeFetch(`/api/finance/student-accounts/${encodeURIComponent(id)}/unblock`, { method: 'POST', body: data });
  }

  // --- Transactions ---
  async getTransactions(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/transactions${qs ? `?${qs}` : ''}`);
  }

  async createTransaction(data: any): Promise<any> {
    return financeFetch('/api/finance/transactions', { method: 'POST', body: data });
  }

  /**
   * ⭐ ÉDITER UN ENCAISSEMENT (promoteur uniquement — garde de rôle côté
   * api-server). Aligne un paiement sur les documents papier de l'école :
   * montant, mode, date, référence, caisse. Les imputations sont
   * ré-échelonnées au prorata, les soldes ajustés, le reçu régénéré.
   */
  async updateTransaction(
    id: string,
    data: {
      amount?: number;
      paymentMethod?: string;
      createdAt?: string;
      reference?: string;
      cashRegisterId?: string | null;
      tenderedAmount?: number;
      reason: string;
    },
  ): Promise<any> {
    return financeFetch(`/api/finance/transactions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: data,
    });
  }

  /**
   * ⭐ SUPPRIMER UN ENCAISSEMENT (promoteur uniquement — garde de rôle côté
   * api-server). Suppression physique exceptionnelle : réverse imputations,
   * soldes, caisses ; trace d'audit complète.
   */
  async deleteTransaction(id: string, reason: string): Promise<any> {
    return financeFetch(`/api/finance/transactions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: { reason },
    });
  }

  /**
   * ⭐ RÉPARTITION MANUELLE — type partagé (flexibilité encaissement sept. 2026).
   * Imputations explicites sur les lignes de frais du compte élève, décidées
   * par la comptable (toggle « répartition personnalisée » + section frais
   * généraux du NewPaymentModal). Le backend impute EXACTEMENT ces lignes.
   */
  async createManualTransaction(data: {
    academicYearId: string;
    studentAccountId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    cashRegisterId?: string;
    tenderedAmount?: number;
    changeGiven?: number;
    manualAllocations: { accountBreakdownId: string; amount: number }[];
  }): Promise<any> {
    return this.createTransaction(data);
  }

  /**
   * Encaissement multi-action : frais scolaires + articles boutique en une seule opération.
   * Retourne { transaction, shopSale, totalAmount, feeAmount, shopAmount }.
   */
  async createMultiActionTransaction(data: {
    academicYearId: string;
    studentAccountId: string;
    feeAmount: number;
    shopItems: { productId: string; quantity: number; unitPrice?: number }[];
    paymentMethod: string;
    reference?: string;
    cashRegisterId?: string;
    customerName?: string;
    notes?: string;
    // ⭐ Espèces : montant remis par le client + reliquat (pour traçabilité reçu)
    tenderedAmount?: number;
    changeGiven?: number;
    // ⭐ RÉPARTITION MANUELLE (flexibilité sept. 2026) — imputations explicites
    manualAllocations?: { accountBreakdownId: string; amount: number }[];
    // ⭐ FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) — sélection catalogue du modal
    //    de paiement : breakdowns créés à la volée par le backend.
    generalFeeAddOns?: { feeStructureId: string; amount: number }[];
  }): Promise<any> {
    return financeFetch('/api/finance/transactions/multi-action', { method: 'POST', body: data });
  }

  /**
   * Récupère les ventes boutique pour une année académique (utilisé par l'onglet
   * Encaissement du module Finance pour afficher les ventes boutique à côté
   * des FinanceTransactions).
   */
  async getShopSales(params: { academicYearId: string; studentId?: string }): Promise<any> {
    const qs = new URLSearchParams({ academicYearId: params.academicYearId });
    if (params.studentId) qs.set('studentId', params.studentId);
    return financeFetch(`/api/finance/shop-sales?${qs.toString()}`);
  }

  /**
   * URL de téléchargement du reçu PDF d'une transaction.
   * À utiliser avec window.open() ou <a href download>.
   */
  getReceiptPdfUrl(transactionId: string): string {
    return `/api/finance/transactions/${encodeURIComponent(transactionId)}/receipt.pdf`;
  }

  /**
   * Renvoie le reçu par email/WhatsApp/SMS/Helm Connect au parent de l'élève.
   * ⭐ 'helm_connect' remplace WhatsApp+SMS : envoie un message Helm Connect
   *    au parent avec le PDF reçu en pièce jointe.
   */
  async resendReceipt(transactionId: string, channels: ('email' | 'whatsapp' | 'sms' | 'helm_connect')[]): Promise<any> {
    return financeFetch(`/api/finance/transactions/${encodeURIComponent(transactionId)}/resend`, {
      method: 'POST',
      body: { channels },
    });
  }

  /**
   * Génère un lien wa.me pour envoi WhatsApp manuel (sans API Gupshup).
   * Retourne { url, phone, message, hasPhone }.
   */
  async getWhatsAppLink(transactionId: string): Promise<any> {
    return financeFetch(`/api/finance/transactions/${encodeURIComponent(transactionId)}/whatsapp-link`);
  }

  async reverseTransaction(id: string, data: { reason: string }): Promise<any> {
    return financeFetch(`/api/finance/transactions/${encodeURIComponent(id)}/reverse`, { method: 'POST', body: data });
  }

  // --- Recovery Reminders ---
  async getRecoveryReminders(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/recovery-reminders${qs ? `?${qs}` : ''}`);
  }

  async sendManualReminder(data: any): Promise<any> {
    return financeFetch('/api/finance/recovery-reminders/manual', { method: 'POST', body: data });
  }

  async runNightlyDetection(): Promise<any> {
    return financeFetch('/api/finance/recovery-reminders/run-nightly', { method: 'POST' });
  }

  /**
   * Envoie une relance multi-canal (email + WhatsApp + SMS) au parent de
   * l'élève ayant un arriéré. Reproduit le pattern des notifications de reçu.
   *
   * POST /api/finance/recovery-reminders/:arrearId/notify
   * Body: { channels: ('email'|'whatsapp'|'sms'|'helm_connect')[], level: 'PREMIERE_RELANCE'|'DEUXIEME_RELANCE'|'MISE_EN_DEMEURE' }
   * Response: { arrearId, level, channels: { email: {status,to?,error?}, whatsapp: {...}, sms: {...}, helm_connect: {...} } }
   */
  async sendRecoveryNotification(
    arrearId: string,
    channels: ('email' | 'whatsapp' | 'sms' | 'helm_connect')[],
    level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE' = 'PREMIERE_RELANCE',
  ): Promise<any> {
    return financeFetch(`/api/finance/recovery-reminders/${encodeURIComponent(arrearId)}/notify`, {
      method: 'POST',
      body: { channels, level },
    });
  }

  // --- Expenses (utilise expenses-v2 qui a le workflow complet : justificatif, budget, audit) ---
  async getExpenses(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/expenses-v2${qs ? `?${qs}` : ''}`);
  }

  async createExpense(data: any): Promise<any> {
    return financeFetch('/api/finance/expenses-v2', { method: 'POST', body: data });
  }

  async approveExpense(id: string): Promise<any> {
    return financeFetch(`/api/finance/expenses-v2/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
  }

  async rejectExpense(id: string, rejectReason: string): Promise<any> {
    return financeFetch(`/api/finance/expenses-v2/${encodeURIComponent(id)}/reject`, { method: 'PATCH', body: { rejectReason } });
  }

  /**
   * Statistiques mensuelles des dépenses pour le graphique d'évolution.
   * GET /api/finance/expenses-v2/monthly-stats?academicYearId=...
   */
  async getExpenseMonthlyStats(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/expenses-v2/monthly-stats?academicYearId=${encodeURIComponent(academicYearId)}`);
  }

  // --- Treasury / Daily Closures ---
  async getDailyClosures(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/treasury/daily-closures${qs ? `?${qs}` : ''}`);
  }

  async createDailyClosure(data: any): Promise<any> {
    return financeFetch('/api/finance/treasury/daily-closures', { method: 'POST', body: data });
  }

  async validateDailyClosure(id: string): Promise<any> {
    return financeFetch(`/api/finance/treasury/daily-closures/${encodeURIComponent(id)}/validate`, { method: 'POST' });
  }

  async getTreasuryStats(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/treasury/statistics${qs ? `?${qs}` : ''}`);
  }

  // --- Reports ---
  async getKpiReports(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/reports/kpi${qs ? `?${qs}` : ''}`);
  }

  async getClassEncaissements(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/reports/class-encaissements${qs ? `?${qs}` : ''}`);
  }

  async getExpenseByCategory(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/reports/expense-by-category${qs ? `?${qs}` : ''}`);
  }

  async getMonthlyEncaissements(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/reports/monthly-encaissements${qs ? `?${qs}` : ''}`);
  }

  async getArrears(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/collection/arrears${qs ? `?${qs}` : ''}`);
  }

  // --- Collection (système NEW : arrears + reminders + promises + actions + cases) ---
  async detectArrears(academicYearId: string): Promise<any> {
    return financeFetch('/api/finance/collection/detect-arrears', {
      method: 'POST',
      body: { academicYearId },
    });
  }

  async getCollectionStatistics(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/collection/statistics?academicYearId=${academicYearId}`);
  }

  async createCollectionReminder(data: any): Promise<any> {
    return financeFetch('/api/finance/collection/reminders', { method: 'POST', body: data });
  }

  async createPaymentPromise(data: any): Promise<any> {
    return financeFetch('/api/finance/collection/promises', { method: 'POST', body: data });
  }

  async createCollectionAction(data: any): Promise<any> {
    return financeFetch('/api/finance/collection/actions', { method: 'POST', body: data });
  }

  async getCollectionCases(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/collection/cases${qs ? `?${qs}` : ''}`);
  }

  async getCollectionCase(studentId: string, academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/collection/cases/${studentId}/${academicYearId}`);
  }

  async syncCollectionCase(studentId: string, academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/collection/cases/${studentId}/${academicYearId}/sync`, { method: 'POST' });
  }

  async triggerCaseReminders(studentId: string, academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/collection/cases/${studentId}/${academicYearId}/trigger-reminders`, { method: 'POST' });
  }

  // --- Phase 2 : Promesses, Actions, Escalade ---
  async getCollectionPromises(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/collection/promises${qs ? `?${qs}` : ''}`);
  }

  async updatePromiseStatus(promiseId: string, status: 'HONORED' | 'BROKEN' | 'PENDING'): Promise<any> {
    return financeFetch(`/api/finance/collection/promises/${promiseId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  async deletePaymentPromise(promiseId: string): Promise<any> {
    return financeFetch(`/api/finance/collection/promises/${promiseId}`, { method: 'DELETE' });
  }

  async deleteCollectionAction(actionId: string): Promise<any> {
    return financeFetch(`/api/finance/collection/actions/${actionId}`, { method: 'DELETE' });
  }

  async getCollectionActions(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/collection/actions${qs ? `?${qs}` : ''}`);
  }

  async getCollectionReminders(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/collection/reminders${qs ? `?${qs}` : ''}`);
  }

  async runEscalation(academicYearId: string): Promise<any> {
    return financeFetch('/api/finance/collection/run-escalation', {
      method: 'POST',
      body: { academicYearId },
    });
  }

  /**
   * Saisie manuelle d'un arriéré pour un élève (onboarding nouveaux clients).
   * POST /api/finance/collection/arrears/manual
   */
  async createManualArrear(data: {
    studentId: string;
    academicYearId?: string;
    academicYearName?: string;
    amount: number;
    reason?: string;
  }): Promise<any> {
    return financeFetch('/api/finance/collection/arrears/manual', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Reporte les arriérés d'une année vers la nouvelle (Phase 2).
   * POST /api/finance/collection/arrears/transfer-year
   */
  async transferArrearsToNewYear(fromAcademicYearId: string, toAcademicYearId: string): Promise<any> {
    return financeFetch('/api/finance/collection/arrears/transfer-year', {
      method: 'POST',
      body: { fromAcademicYearId, toAcademicYearId },
    });
  }

  /**
   * Abandonne une créance (write-off) — Phase 3.
   * POST /api/finance/collection/arrears/:id/write-off
   */
  async writeOffArrear(arrearId: string, reason: string): Promise<any> {
    return financeFetch(`/api/finance/collection/arrears/${encodeURIComponent(arrearId)}/write-off`, {
      method: 'POST',
      body: { reason },
    });
  }

  /**
   * ⭐ RECOUVREMENT — Encaissement direct d'un arriéré (marquer un élève
   * ayant payé tout ou partie de son arriéré). Le backend crée la
   * FinanceTransaction PAYMENT ; le trigger DB update_balance_after_transaction
   * recalcule automatiquement le compte de l'élève (totalPaid / balance /
   * status) et l'arriéré (totalPaid / balanceDue / status) dans la même
   * transaction atomique.
   * POST /api/finance/collection/arrears/:id/payment
   */
  async recordArrearPayment(
    arrearId: string,
    payload: {
      amount: number;
      paymentMethod?: string;
      reference?: string;
      cashRegisterId?: string;
      notes?: string;
    },
  ): Promise<any> {
    return financeFetch(`/api/finance/collection/arrears/${encodeURIComponent(arrearId)}/payment`, {
      method: 'POST',
      body: payload,
    });
  }

  /**
   * Récapitulatif des arriérés par année scolaire — Phase 5.
   * GET /api/finance/collection/arrears/summary-by-year
   */
  async getArrearsSummaryByYear(): Promise<any> {
    return financeFetch('/api/finance/collection/arrears/summary-by-year');
  }

  // --- Nouveaux rapports (Phase 6) ---
  async getComparativeYear(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/reports/comparative-year?academicYearId=${academicYearId}`);
  }

  async getTop10Impayes(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/reports/top-10-impayes?academicYearId=${academicYearId}`);
  }

  async getProjectionTresorerie(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/reports/projection-tresorerie?academicYearId=${academicYearId}`);
  }

  async getCashRegisterComparative(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/reports/cash-register-comparative?academicYearId=${academicYearId}`);
  }

  /**
   * Bilan périodique — agrégats encaissements/dépenses/solde sur une période
   * filtrée par date, classe et caisse.
   */
  async getBilanPeriodique(
    academicYearId: string,
    filters?: { dateFrom?: string; dateTo?: string; classId?: string; cashRegisterId?: string },
  ): Promise<any> {
    const qs = new URLSearchParams({ academicYearId });
    if (filters?.dateFrom) qs.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) qs.set('dateTo', filters.dateTo);
    if (filters?.classId) qs.set('classId', filters.classId);
    if (filters?.cashRegisterId) qs.set('cashRegisterId', filters.cashRegisterId);
    return financeFetch(`/api/finance/reports/bilan-periodique?${qs.toString()}`);
  }

  /**
   * Journal de caisse — liste des transactions filtrées par caisse + date.
   */
  async getJournalCaisse(
    academicYearId: string,
    filters?: { dateFrom?: string; dateTo?: string; cashRegisterId?: string; type?: string },
  ): Promise<any> {
    const qs = new URLSearchParams({ academicYearId });
    if (filters?.dateFrom) qs.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) qs.set('dateTo', filters.dateTo);
    if (filters?.cashRegisterId) qs.set('cashRegisterId', filters.cashRegisterId);
    if (filters?.type) qs.set('type', filters.type);
    return financeFetch(`/api/finance/reports/journal-caisse?${qs.toString()}`);
  }

  /**
   * Transactions suspectes — annulations, transactions nocturnes, montants élevés.
   */
  async getSuspiciousTransactions(
    academicYearId: string,
    options?: { days?: number; minAmount?: number },
  ): Promise<any> {
    const qs = new URLSearchParams({ academicYearId });
    if (options?.days) qs.set('days', String(options.days));
    if (options?.minAmount) qs.set('minAmount', String(options.minAmount));
    return financeFetch(`/api/finance/reports/suspicious-transactions?${qs.toString()}`);
  }

  /**
   * Écarts caisse — comparaison solde théorique vs solde déclaré.
   */
  async getCashMismatches(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/reports/cash-mismatches?academicYearId=${academicYearId}`);
  }

  /**
   * Clôtures manquées sur la période.
   */
  async getMissedClosures(academicYearId: string, days: number = 30): Promise<any> {
    return financeFetch(`/api/finance/reports/missed-closures?academicYearId=${academicYearId}&days=${days}`);
  }

  /**
   * Top 10 comptables les plus actifs.
   */
  async getTopAccountants(academicYearId: string, days: number = 30): Promise<any> {
    return financeFetch(`/api/finance/reports/top-accountants?academicYearId=${academicYearId}&days=${days}`);
  }

  // --- Cash Registers ---
  async getCashRegisters(params?: { isActive?: boolean; isOpen?: boolean; responsibleUserId?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params?.isOpen !== undefined) query.set('isOpen', String(params.isOpen));
    if (params?.responsibleUserId) query.set('responsibleUserId', params.responsibleUserId);
    const qs = query.toString();
    // ⭐ noCache : l'état ouvert/fermé d'une caisse est une donnée OPÉRATIONNELLE
    //    (elle conditionne la possibilité d'encaisser) — pas de cache 45s ici.
    return financeFetch(`/api/finance/cash-registers${qs ? `?${qs}` : ''}`, { noCache: true });
  }

  async getCashRegister(id: string): Promise<any> {
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}`);
  }

  async createCashRegister(data: any): Promise<any> {
    return financeFetch('/api/finance/cash-registers', { method: 'POST', body: data });
  }

  async updateCashRegister(id: string, data: any): Promise<any> {
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
  }

  async archiveCashRegister(id: string): Promise<any> {
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async openCashRegister(id: string, data: { openingBalance?: number; note?: string }): Promise<any> {
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}/open`, { method: 'POST', body: data });
  }

  async closeCashRegister(id: string, data: { countedBalance?: number; note?: string }): Promise<any> {
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}/close`, { method: 'POST', body: data });
  }

  async getCashRegisterStats(id: string, params?: { dateFrom?: string; dateTo?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString();
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}/stats${qs ? `?${qs}` : ''}`);
  }

  /**
   * Transfert de fonds entre deux caisses.
   */
  async transferCashRegister(data: { fromId: string; toId: string; amount: number; note?: string }): Promise<any> {
    return financeFetch('/api/finance/cash-registers/transfer', { method: 'POST', body: data });
  }

  /**
   * Historique des transferts inter-caisses d'un tenant.
   * Filtres optionnels : cashRegisterId, dateFrom, dateTo, limit.
   */
  async getCashRegisterTransfers(params?: {
    cashRegisterId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<any> {
    const qs = params
      ? new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]
        ).toString()
      : '';
    return financeFetch(`/api/finance/cash-registers/transfers${qs ? `?${qs}` : ''}`);
  }

  /**
   * Historique des transactions d'une caisse (transferts in/out, ajustements).
   */
  async getCashRegisterTransactions(id: string, params?: {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }): Promise<any> {
    const qs = params
      ? new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]
        ).toString()
      : '';
    return financeFetch(`/api/finance/cash-registers/${encodeURIComponent(id)}/transactions${qs ? `?${qs}` : ''}`);
  }

  // --- Settings ---
  async getSettings(): Promise<any> {
    return financeFetch('/api/finance/settings');
  }

  async updateSettings(data: any): Promise<any> {
    return financeFetch('/api/finance/settings', { method: 'PATCH', body: data });
  }

  /**
   * Historique des modifications des paramètres financiers.
   * Lit les entrées financial_audit_logs (entityType = 'FinancialSettings').
   */
  async getSettingsHistory(): Promise<any> {
    return financeFetch('/api/finance/settings/history');
  }

  /**
   * Alertes ORION — surveillance des changements critiques des 30 derniers jours.
   */
  async getSettingsOrionAlerts(): Promise<any> {
    return financeFetch('/api/finance/settings/orion-alerts');
  }

  /**
   * Déclenche manuellement l'envoi de l'export comptable mensuel au comptable.
   * POST /api/finance/settings/send-compta-export
   * Retourne { success: boolean, message: string }.
   */
  async sendComptaExportTest(): Promise<any> {
    return financeFetch('/api/finance/settings/send-compta-export', { method: 'POST' });
  }

  // --- Audit ---
  // ⭐ FIX 2026-09-09 : academicYearId optionnel — l'onglet Audit du module
  //    Finance suit l'année du sélecteur global (anomalies de la période).
  async getAnomalies(limit: number = 30, academicYearId?: string): Promise<any> {
    const qs = academicYearId ? `&academicYearId=${encodeURIComponent(academicYearId)}` : '';
    return financeFetch(`/api/finance/anomalies?limit=${limit}${qs}`);
  }

  async getAuditLogs(limit: number = 30): Promise<any> {
    return financeFetch(`/api/finance/audit-logs?limit=${limit}`);
  }

  // --- Fee Regimes ---
  async getFeeRegimes(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/fee-regimes${qs ? `?${qs}` : ''}`);
  }

  async createFeeRegime(data: any): Promise<any> {
    return financeFetch('/api/finance/fee-regimes', { method: 'POST', body: data });
  }

  async updateFeeRegime(id: string, data: any): Promise<any> {
    return financeFetch(`/api/finance/fee-regimes/${encodeURIComponent(id)}`, { method: 'PUT', body: data });
  }

  async deleteFeeRegime(id: string): Promise<any> {
    return financeFetch(`/api/finance/fee-regimes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async addFeeRegimeRule(regimeId: string, data: any): Promise<any> {
    return financeFetch(`/api/finance/fee-regimes/${encodeURIComponent(regimeId)}/rules`, { method: 'POST', body: data });
  }

  async createStudentFeeProfile(data: any): Promise<any> {
    return financeFetch('/api/finance/student-fee-profiles', { method: 'POST', body: data });
  }

  async exportReports(data: any): Promise<any> {
    return financeFetch('/api/finance/reports/export', { method: 'POST', body: data });
  }

  // --- Expense categories & budgets (aliases) ---
  async getExpenseCategories(): Promise<any> {
    return financeFetch('/api/finance/expenses/categories');
  }

  async getExpenseBudgets(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/expenses-v2/budgets?academicYearId=${academicYearId}`);
  }

  // --- Treasury aliases (page uses getTreasuryClosures etc.) ---
  // ⭐ V1 audit — from/to transmis : la page Trésorerie calcule filterFrom/
  //    filterTo mais ne les passait pas au service → filtre période sans effet.
  async getTreasuryClosures(academicYearId: string, from?: string, to?: string): Promise<any> {
    const qs = new URLSearchParams({ academicYearId });
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return financeFetch(`/api/finance/treasury/daily-closures?${qs.toString()}`);
  }

  async createTreasuryClosure(data: any): Promise<any> {
    return financeFetch('/api/finance/treasury/daily-closures', { method: 'POST', body: data });
  }

  async validateTreasuryClosure(id: string): Promise<any> {
    return financeFetch(`/api/finance/treasury/daily-closures/${encodeURIComponent(id)}/validate`, { method: 'POST' });
  }

  // ─── Promoter Eligibility — élèves "paiement direct au fondateur" ─────────

  /**
   * Active le flag "paiement fondateur" pour un élève (avec motif obligatoire).
   */
  async activatePromoterEligibility(data: {
    studentId: string;
    academicYearId: string;
    motif: string;
    expectedDate?: string;
  }): Promise<{ success: boolean; id: string }> {
    return financeFetch('/api/finance/promoter-eligibility/activate', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Désactive le flag (toggle off).
   */
  async deactivatePromoterEligibility(studentId: string, academicYearId: string): Promise<{ success: boolean }> {
    return financeFetch('/api/finance/promoter-eligibility/deactivate', {
      method: 'POST',
      body: { studentId, academicYearId },
    });
  }

  /**
   * Liste tous les élèves marqués actifs (sous-onglet "Reçu par le fondateur").
   */
  async listPromoterEligible(academicYearId: string): Promise<any[]> {
    if (!academicYearId) return [];
    const res = await financeFetch(`/api/finance/promoter-eligibility?academicYearId=${encodeURIComponent(academicYearId)}`);
    return Array.isArray(res) ? res : [];
  }

  /**
   * Vérifie en masse les statuts d'éligibilité (pour afficher les toggles).
   */
  async bulkCheckPromoterEligibility(studentIds: string[], academicYearId: string): Promise<Set<string>> {
    if (!academicYearId || studentIds.length === 0) return new Set();
    const idsParam = studentIds.join(',');
    const res = await financeFetch(`/api/finance/promoter-eligibility/bulk-check?academicYearId=${encodeURIComponent(academicYearId)}&studentIds=${encodeURIComponent(idsParam)}`);
    return new Set(res.eligibleStudentIds || []);
  }
}

export const financeService = new FinanceService();
