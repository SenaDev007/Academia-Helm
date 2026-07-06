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
   * Modifie un override existant (montant personnalisé + motif).
   */
  async updateFeeOverride(id: string, data: { customAmount?: number; reason?: string }): Promise<any> {
    return financeFetch(`/api/finance/fee-structures/overrides/${encodeURIComponent(id)}`, { method: 'PATCH', body: data });
  }

  // --- Student Accounts ---
  async getStudentAccounts(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/student-accounts${qs ? `?${qs}` : ''}`);
  }

  async getStudentAccountDetails(id: string): Promise<any> {
    return financeFetch(`/api/finance/student-accounts/${encodeURIComponent(id)}`);
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
   * URL de téléchargement du reçu PDF d'une transaction.
   * À utiliser avec window.open() ou <a href download>.
   */
  getReceiptPdfUrl(transactionId: string): string {
    return `/api/finance/transactions/${encodeURIComponent(transactionId)}/receipt.pdf`;
  }

  /**
   * Renvoie le reçu par email/WhatsApp/SMS au parent de l'élève.
   */
  async resendReceipt(transactionId: string, channels: ('email' | 'whatsapp' | 'sms')[]): Promise<any> {
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
   * Body: { channels: ('email'|'whatsapp'|'sms')[], level: 'PREMIERE_RELANCE'|'DEUXIEME_RELANCE'|'MISE_EN_DEMEURE' }
   * Response: { arrearId, level, channels: { email: {status,to?,error?}, whatsapp: {...}, sms: {...} } }
   */
  async sendRecoveryNotification(
    arrearId: string,
    channels: ('email' | 'whatsapp' | 'sms')[],
    level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE' = 'PREMIERE_RELANCE',
  ): Promise<any> {
    return financeFetch(`/api/finance/recovery-reminders/${encodeURIComponent(arrearId)}/notify`, {
      method: 'POST',
      body: { channels, level },
    });
  }

  // --- Expenses ---
  async getExpenses(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return financeFetch(`/api/finance/expenses${qs ? `?${qs}` : ''}`);
  }

  async createExpense(data: any): Promise<any> {
    return financeFetch('/api/finance/expenses', { method: 'POST', body: data });
  }

  async approveExpense(id: string): Promise<any> {
    return financeFetch(`/api/finance/expenses/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  }

  async rejectExpense(id: string, reason: string): Promise<any> {
    return financeFetch(`/api/finance/expenses/${encodeURIComponent(id)}/reject`, { method: 'POST', body: { reason } });
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

  // --- Cash Registers ---
  async getCashRegisters(params?: { isActive?: boolean; isOpen?: boolean; responsibleUserId?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params?.isOpen !== undefined) query.set('isOpen', String(params.isOpen));
    if (params?.responsibleUserId) query.set('responsibleUserId', params.responsibleUserId);
    const qs = query.toString();
    return financeFetch(`/api/finance/cash-registers${qs ? `?${qs}` : ''}`);
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

  // --- Audit ---
  async getAnomalies(limit: number = 30): Promise<any> {
    return financeFetch(`/api/finance/anomalies?limit=${limit}`);
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
    return financeFetch(`/api/finance/expenses/budgets?academicYearId=${academicYearId}`);
  }

  // --- Treasury aliases (page uses getTreasuryClosures etc.) ---
  async getTreasuryClosures(academicYearId: string): Promise<any> {
    return financeFetch(`/api/finance/treasury/daily-closures?academicYearId=${academicYearId}`);
  }

  async createTreasuryClosure(data: any): Promise<any> {
    return financeFetch('/api/finance/treasury/daily-closures', { method: 'POST', body: data });
  }

  async validateTreasuryClosure(id: string): Promise<any> {
    return financeFetch(`/api/finance/treasury/daily-closures/${encodeURIComponent(id)}/validate`, { method: 'POST' });
  }
}

export const financeService = new FinanceService();
