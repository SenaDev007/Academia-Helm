/**
 * ============================================================================
 * FINANCE SERVICE - API Client pour le module Finance
 * ============================================================================
 */

import { apiFetch } from '@/lib/api/client';
import { createEntityOffline, updateEntityOffline } from '@/lib/offline/offline-business.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { LocalSearchService } from '@/lib/offline/local-search.service';

const BASE_URL = '/finance';

function getTenantId(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : "";
}

class FinanceService {
  async getFeeRegimes(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/fee-regimes${qs ? `?${qs}` : ''}`);
  }

  async createStudentFeeProfile(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/student-fee-profiles`, {
      method: 'POST',
      body: data,
    });
  }

  // --- Fee Structures ---
  async getFeeStructures(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("fee_structures", { tenantId: getTenantId() });
    }
    
    try {
      return await apiFetch(`${BASE_URL}/fee-structures${qs ? `?${qs}` : ''}`);
    } catch (error) {
      return LocalSearchService.search("fee_structures", { tenantId: getTenantId() });
    }
  }

  async createFeeStructure(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'FEE_STRUCTURE', data);
    }
    return apiFetch(`${BASE_URL}/fee-structures`, { method: 'POST', body: data });
  }

  async updateFeeStructure(id: string, data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'FEE_STRUCTURE', id, data);
    }
    return apiFetch(`${BASE_URL}/fee-structures/${id}`, { method: 'PUT', body: data });
  }

  async deleteFeeStructure(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/fee-structures/${id}`, { method: 'DELETE' });
  }

  async copyFeeStructuresToYear(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/fee-structures/copy-to-year`, { method: 'POST', body: data });
  }

  async overrideFeeStructure(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/fee-structures/override`, { method: 'POST', body: data });
  }

  // --- Expenses ---
  async getExpenses(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    if (!networkDetectionService.isConnected()) {
      return LocalSearchService.search("expenses", { tenantId: getTenantId() });
    }
    try {
      return await apiFetch(`${BASE_URL}/expenses-v2${qs ? `?${qs}` : ''}`);
    } catch (e) {
      return LocalSearchService.search("expenses", { tenantId: getTenantId() });
    }
  }

  async getExpenseBudgets(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/expenses-v2/budgets?academicYearId=${academicYearId}`);
  }

  async getExpenseCategories(): Promise<any> {
    return apiFetch(`${BASE_URL}/expenses/categories`);
  }

  async createExpense(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return createEntityOffline(tenantId, 'EXPENSE', data);
    }
    return apiFetch(`${BASE_URL}/expenses-v2`, { method: 'POST', body: data });
  }

  async approveExpense(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/expenses-v2/${id}/approve`, { method: 'PATCH' });
  }

  async rejectExpense(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/expenses-v2/${id}/reject`, { method: 'PATCH' });
  }

  // --- Settings ---
  async getSettings(): Promise<any> {
    return apiFetch(`${BASE_URL}/settings`);
  }

  async updateSettings(data: any): Promise<any> {
    const tenantId = getTenantId();
    if (tenantId) {
      return updateEntityOffline(tenantId, 'FINANCE_SETTING', 'settings', data);
    }
    return apiFetch(`${BASE_URL}/settings`, { method: 'POST', body: data });
  }

  // --- Treasury ---
  async getTreasuryClosures(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/treasury/daily-closures?academicYearId=${academicYearId}`);
  }

  async createTreasuryClosure(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/treasury/daily-closures`, { method: 'POST', body: data });
  }

  async validateTreasuryClosure(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/treasury/daily-closures/${id}/validate`, { method: 'PATCH' });
  }

  // --- Student Accounts ---
  async getStudentAccounts(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/student-accounts${qs ? `?${qs}` : ''}`);
  }

  async getStudentAccountDetails(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/student-accounts/${id}`);
  }

  async unblockStudentAccount(id: string, data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/student-accounts/${id}/unblock`, { method: 'POST', body: data });
  }

  // --- Transactions ---
  async getTransactions(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/transactions${qs ? `?${qs}` : ''}`);
  }

  async createTransaction(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/transactions`, { method: 'POST', body: data });
  }

  // --- Recovery Reminders ---
  async getRecoveryReminders(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/recovery-reminders?academicYearId=${academicYearId}`);
  }

  async sendManualRecoveryReminder(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/recovery-reminders/manual`, { method: 'POST', body: data });
  }

  async runNightlyRecoveryReminders(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/recovery-reminders/run-nightly`, { method: 'POST', body: data });
  }

  // --- Reports & Dashboards ---
  async getKpiReports(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/reports/kpi${qs ? `?${qs}` : ''}`);
  }

  async getClassEncaissements(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/reports/class-encaissements${qs ? `?${qs}` : ''}`);
  }

  async getExpenseByCategory(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/reports/expense-by-category${qs ? `?${qs}` : ''}`);
  }

  async getMonthlyEncaissements(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/reports/monthly-encaissements${qs ? `?${qs}` : ''}`);
  }

  // --- Nouveaux rapports (Phase 6) ---
  async getComparativeYear(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/reports/comparative-year?academicYearId=${academicYearId}`);
  }

  async getTop10Impayes(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/reports/top-10-impayes?academicYearId=${academicYearId}`);
  }

  async getProjectionTresorerie(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/reports/projection-tresorerie?academicYearId=${academicYearId}`);
  }

  async getCashRegisterComparative(academicYearId: string): Promise<any> {
    return apiFetch(`${BASE_URL}/reports/cash-register-comparative?academicYearId=${academicYearId}`);
  }

  async getArrears(params?: Record<string, string>): Promise<any> {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return apiFetch(`${BASE_URL}/collection/arrears${qs ? `?${qs}` : ''}`);
  }

  async exportReports(data: any): Promise<any> {
    return apiFetch(`${BASE_URL}/reports/export`, { method: 'POST', body: data });
  }

  // --- Audit ---
  async getAnomalies(limit: number = 30): Promise<any> {
    return apiFetch(`${BASE_URL}/anomalies?limit=${limit}`);
  }

  async getAuditLogs(limit: number = 30): Promise<any> {
    return apiFetch(`${BASE_URL}/audit-logs?limit=${limit}`);
  }

  // --- Multi-caisses (CashRegister) ---
  async getCashRegisters(params?: { isActive?: boolean; isOpen?: boolean; responsibleUserId?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    if (params?.isOpen !== undefined) query.set('isOpen', String(params.isOpen));
    if (params?.responsibleUserId) query.set('responsibleUserId', params.responsibleUserId);
    const qs = query.toString();
    return apiFetch(`${BASE_URL}/cash-registers${qs ? `?${qs}` : ''}`);
  }

  async getCashRegister(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/cash-registers/${id}`);
  }

  async createCashRegister(data: {
    code: string;
    name: string;
    description?: string;
    responsibleUserId?: string;
    location?: string;
    openingBalance?: number;
    isActive?: boolean;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/cash-registers`, { method: 'POST', body: data });
  }

  async updateCashRegister(id: string, data: {
    name?: string;
    description?: string;
    responsibleUserId?: string;
    location?: string;
    isActive?: boolean;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/cash-registers/${id}`, { method: 'PATCH', body: data });
  }

  async archiveCashRegister(id: string): Promise<any> {
    return apiFetch(`${BASE_URL}/cash-registers/${id}`, { method: 'DELETE' });
  }

  async openCashRegister(id: string, data: { openingBalance?: number; note?: string }): Promise<any> {
    return apiFetch(`${BASE_URL}/cash-registers/${id}/open`, { method: 'POST', body: data });
  }

  async closeCashRegister(id: string, data: { countedBalance?: number; note?: string }): Promise<any> {
    return apiFetch(`${BASE_URL}/cash-registers/${id}/close`, { method: 'POST', body: data });
  }

  async getCashRegisterStats(id: string, params?: { dateFrom?: string; dateTo?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params?.dateTo) query.set('dateTo', params.dateTo);
    const qs = query.toString();
    return apiFetch(`${BASE_URL}/cash-registers/${id}/stats${qs ? `?${qs}` : ''}`);
  }

  // --- Transactions avec cashRegisterId ---
  async createTransaction(data: {
    academicYearId: string;
    studentAccountId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    cashRegisterId?: string;
  }): Promise<any> {
    return apiFetch(`${BASE_URL}/transactions`, { method: 'POST', body: data });
  }
}

export const financeService = new FinanceService();
