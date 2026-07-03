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

  // --- Settings ---
  async getSettings(): Promise<any> {
    return financeFetch('/api/finance/settings');
  }

  async updateSettings(data: any): Promise<any> {
    return financeFetch('/api/finance/settings', { method: 'PATCH', body: data });
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

  async createStudentFeeProfile(data: any): Promise<any> {
    return financeFetch('/api/finance/student-fee-profiles', { method: 'POST', body: data });
  }

  async exportReports(data: any): Promise<any> {
    return financeFetch('/api/finance/reports/export', { method: 'POST', body: data });
  }
}

export const financeService = new FinanceService();
