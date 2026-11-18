/**
 * ============================================================================
 * FINANCE HOOKS — Hooks React Query pour le module Finance
 * ============================================================================
 *
 * Hooks principaux pour le module Finance :
 *   - useArrears : liste des arriérés (recovery)
 *   - useCollectionReminders : relances de recouvrement
 *   - useStudentAccounts : comptes élèves (soldes)
 *   - useTransactions : transactions
 *   - useCashRegisters : caisses
 *   - useExpenses : dépenses
 *   - useFinanceKpis : KPIs tableau de bord
 *
 * Tous utilisent financeService comme couche de transport + React Query pour
 * le cache (5 min) + dégradation gracieuse au timeout.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { financeService } from '@/services/finance.service';
import { financeKeys } from './finance-query-keys';

const DEFAULT_STALE_TIME = 2 * 60 * 1000; // 2 min (les données financières changent souvent)
const DEFAULT_GC_TIME = 10 * 60 * 1000;   // 10 min

// ─── Arrears / Recovery ──────────────────────────────────────────────────────

export function useArrears(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.arrears.list(params),
    queryFn: async () => {
      try {
        const data = await financeService.getArrears(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useArrears] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useArrearsSummary(tenantId: string, academicYearId: string) {
  return useQuery({
    queryKey: financeKeys.arrears.summary(tenantId, academicYearId),
    queryFn: async () => {
      try {
        // getArrearsSummaryByYear n'existe pas — on utilise getArrears avec params
        const data = await financeService.getArrears({ academicYearId, summary: true });
        return data;
      } catch (err: any) {
        console.warn('[useArrearsSummary] Error:', err.message);
        return null;
      }
    },
    enabled: !!tenantId && !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useCollectionStatistics(tenantId: string, academicYearId: string) {
  return useQuery({
    queryKey: financeKeys.arrears.statistics(tenantId, academicYearId),
    queryFn: async () => {
      try {
        return await financeService.getCollectionStatistics(academicYearId);
      } catch (err: any) {
        console.warn('[useCollectionStatistics] Error:', err.message);
        return null;
      }
    },
    enabled: !!tenantId && !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Collection (reminders) ─────────────────────────────────────────────────

export function useCollectionReminders(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.collection.reminders(params),
    queryFn: async () => {
      try {
        const data = await financeService.getCollectionReminders(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useCollectionReminders] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.transactions.list(params),
    queryFn: async () => {
      try {
        const data = await financeService.getTransactions(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useTransactions] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Cash Registers ────────────────────────────────────────────────────────────

export function useCashRegisters(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.cashRegisters.list(params),
    queryFn: async () => {
      try {
        const data = await financeService.getCashRegisters(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useCashRegisters] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useCashRegisterDashboard(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.cashRegisters.dashboard(params),
    queryFn: async () => {
      try {
        // Pas de méthode dashboard dédiée — on combine stats + cash registers
        const cashRegisters = await financeService.getCashRegisters({ isActive: true });
        return { cashRegisters };
      } catch (err: any) {
        console.warn('[useCashRegisterDashboard] Error:', err.message);
        return null;
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

export function useExpenses(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.expenses.list(params),
    queryFn: async () => {
      try {
        const data = await financeService.getExpenses(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useExpenses] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useExpenseBudgets(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.expenses.budgets(params),
    queryFn: async () => {
      try {
        const data = await financeService.getExpenseBudgets(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useExpenseBudgets] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Reports / KPIs ──────────────────────────────────────────────────────────

export function useFinanceKpis(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.reports.kpis(params),
    queryFn: async () => {
      try {
        return await financeService.getKpiReports(params);
      } catch (err: any) {
        console.warn('[useFinanceKpis] Error:', err.message);
        return null;
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function useTop10Impayes(params: any, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: financeKeys.reports.top10Impayes(params),
    queryFn: async () => {
      try {
        const data = await financeService.getTop10Impayes(params);
        return Array.isArray(data) ? data : (data?.data ?? []);
      } catch (err: any) {
        console.warn('[useTop10Impayes] Error:', err.message);
        return [];
      }
    },
    enabled: options.enabled !== false,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useFinanceSettings(tenantId?: string) {
  return useQuery({
    queryKey: financeKeys.settings.finance(tenantId),
    queryFn: async () => {
      try {
        return await financeService.getSettings();
      } catch (err: any) {
        console.warn('[useFinanceSettings] Error:', err.message);
        return null;
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 min (settings changent rarement)
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

export function usePaymentConfig(tenantId?: string) {
  return useQuery({
    queryKey: financeKeys.settings.payment(tenantId),
    queryFn: async () => {
      // Pas de méthode dédiée — on utilise getSettings et on extrait paymentConfig
      try {
        const settings = await financeService.getSettings();
        return settings?.paymentConfig ?? null;
      } catch (err: any) {
        console.warn('[usePaymentConfig] Error:', err.message);
        return null;
      }
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}
