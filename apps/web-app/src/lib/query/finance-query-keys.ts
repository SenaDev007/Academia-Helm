/**
 * ============================================================================
 * FINANCE QUERY KEYS — Factory pour cache invalidation React Query
 * ============================================================================
 *
 * Centralise toutes les query keys du module Finance pour permettre
 * l'invalidation croisée entre hooks (ex: après createTransaction,
 * invalider useTransactions + useStudentAccounts + useKpiReports).
 *
 * Usage :
 *   import { financeKeys } from '@/lib/query/finance-query-keys';
 *   useQuery({ queryKey: financeKeys.arrears(tenantId, yearId), ... })
 *   // Invalidation après mutation :
 *   queryClient.invalidateQueries({ queryKey: financeKeys.arrears.all(tenantId) })
 * ============================================================================
 */

export const financeKeys = {
  all: ['finance'] as const,
  lists: () => [...financeKeys.all, 'list'] as const,
  details: () => [...financeKeys.all, 'detail'] as const,

  // ─── Arrears / Recovery ───────────────────────────────────────────────────
  arrears: {
    all: (tenantId?: string) => [...financeKeys.all, 'arrears', tenantId] as const,
    list: (params: any) => [...financeKeys.all, 'arrears', 'list', params] as const,
    summary: (tenantId: string, yearId: string) =>
      [...financeKeys.all, 'arrears', 'summary', tenantId, yearId] as const,
    statistics: (tenantId: string, yearId: string) =>
      [...financeKeys.all, 'arrears', 'statistics', tenantId, yearId] as const,
  },

  // ─── Collection ────────────────────────────────────────────────────────────
  collection: {
    all: (tenantId?: string) => [...financeKeys.all, 'collection', tenantId] as const,
    reminders: (params: any) => [...financeKeys.all, 'collection', 'reminders', params] as const,
    promises: (params: any) => [...financeKeys.all, 'collection', 'promises', params] as const,
    actions: (params: any) => [...financeKeys.all, 'collection', 'actions', params] as const,
    cases: (params: any) => [...financeKeys.all, 'collection', 'cases', params] as const,
  },

  // ─── Student Accounts ────────────────────────────────────────────────────
  studentAccounts: {
    all: (tenantId?: string) => [...financeKeys.all, 'student-accounts', tenantId] as const,
    list: (params: any) => [...financeKeys.all, 'student-accounts', 'list', params] as const,
    detail: (id: string) => [...financeKeys.all, 'student-accounts', 'detail', id] as const,
  },

  // ─── Transactions ────────────────────────────────────────────────────────
  transactions: {
    all: (tenantId?: string) => [...financeKeys.all, 'transactions', tenantId] as const,
    list: (params: any) => [...financeKeys.all, 'transactions', 'list', params] as const,
  },

  // ─── Cash Registers ──────────────────────────────────────────────────────
  cashRegisters: {
    all: (tenantId?: string) => [...financeKeys.all, 'cash-registers', tenantId] as const,
    list: (params: any) => [...financeKeys.all, 'cash-registers', 'list', params] as const,
    detail: (id: string) => [...financeKeys.all, 'cash-registers', 'detail', id] as const,
    dashboard: (params: any) => [...financeKeys.all, 'cash-registers', 'dashboard', params] as const,
    stats: (id: string, params: any) =>
      [...financeKeys.all, 'cash-registers', 'stats', id, params] as const,
    transactions: (id: string, params: any) =>
      [...financeKeys.all, 'cash-registers', 'transactions', id, params] as const,
  },

  // ─── Expenses ─────────────────────────────────────────────────────────────
  expenses: {
    all: (tenantId?: string) => [...financeKeys.all, 'expenses', tenantId] as const,
    list: (params: any) => [...financeKeys.all, 'expenses', 'list', params] as const,
    budgets: (params: any) => [...financeKeys.all, 'expenses', 'budgets', params] as const,
    monthlyStats: (params: any) => [...financeKeys.all, 'expenses', 'monthly-stats', params] as const,
    byCategory: (params: any) => [...financeKeys.all, 'expenses', 'by-category', params] as const,
  },

  // ─── Treasury ─────────────────────────────────────────────────────────────
  treasury: {
    all: (tenantId?: string) => [...financeKeys.all, 'treasury', tenantId] as const,
    dailyClosures: (params: any) => [...financeKeys.all, 'treasury', 'daily-closures', params] as const,
    stats: (params: any) => [...financeKeys.all, 'treasury', 'stats', params] as const,
  },

  // ─── Reports / KPIs ──────────────────────────────────────────────────────
  reports: {
    all: (tenantId?: string) => [...financeKeys.all, 'reports', tenantId] as const,
    kpis: (params: any) => [...financeKeys.all, 'reports', 'kpis', params] as const,
    classEncaissements: (params: any) =>
      [...financeKeys.all, 'reports', 'class-encaissements', params] as const,
    monthlyEncaissements: (params: any) =>
      [...financeKeys.all, 'reports', 'monthly-encaissements', params] as const,
    bilanPeriodique: (params: any) =>
      [...financeKeys.all, 'reports', 'bilan-periodique', params] as const,
    journalCaisse: (params: any) =>
      [...financeKeys.all, 'reports', 'journal-caisse', params] as const,
    projection: (params: any) =>
      [...financeKeys.all, 'reports', 'projection', params] as const,
    comparative: (params: any) =>
      [...financeKeys.all, 'reports', 'comparative', params] as const,
    top10Impayes: (params: any) =>
      [...financeKeys.all, 'reports', 'top10-impayes', params] as const,
  },

  // ─── Fee Structures ─────────────────────────────────────────────────────
  feeStructures: {
    all: (tenantId?: string) => [...financeKeys.all, 'fee-structures', tenantId] as const,
    list: (params: any) => [...financeKeys.all, 'fee-structures', 'list', params] as const,
    overrides: (params: any) => [...financeKeys.all, 'fee-structures', 'overrides', params] as const,
  },

  // ─── Settings ────────────────────────────────────────────────────────────
  settings: {
    all: (tenantId?: string) => [...financeKeys.all, 'settings', tenantId] as const,
    finance: (tenantId?: string) => [...financeKeys.all, 'settings', 'finance', tenantId] as const,
    payment: (tenantId?: string) => [...financeKeys.all, 'settings', 'payment', tenantId] as const,
  },
} as const;
