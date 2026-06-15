/**
 * ============================================================================
 * QUERY KEYS — Clés de cache pour @tanstack/react-query
 * ============================================================================
 *
 * Centralise toutes les clés de cache pour éviter les collisions
 * et faciliter l'invalidation ciblée après les mutations.
 *
 * Convention : [entity, ...identifiers, action?]
 * ============================================================================
 */

export const queryKeys = {
  // ── Auth & Context ──
  auth: {
    me: ['auth', 'me'] as const,
    bootstrap: (tenantId: string) => ['auth', 'bootstrap', tenantId] as const,
  },

  // ── Attendance ──
  attendance: {
    all: (tenantId: string) => ['attendance', tenantId] as const,
    byStaff: (tenantId: string, staffId: string) => ['attendance', tenantId, 'staff', staffId] as const,
    byDate: (tenantId: string, date: string) => ['attendance', tenantId, 'date', date] as const,
    stats: (tenantId: string) => ['attendance', tenantId, 'stats'] as const,
  },

  // ── Finance ──
  finance: {
    transactions: (tenantId: string, academicYearId: string) =>
      ['finance', 'transactions', tenantId, academicYearId] as const,
    payments: (tenantId: string, academicYearId: string) =>
      ['finance', 'payments', tenantId, academicYearId] as const,
    studentAccount: (tenantId: string, accountId: string) =>
      ['finance', 'student-account', tenantId, accountId] as const,
    summary: (tenantId: string) => ['finance', 'summary', tenantId] as const,
    settings: (tenantId: string) => ['finance', 'settings', tenantId] as const,
  },

  // ── Exams ──
  exams: {
    evaluations: (tenantId: string) => ['exams', 'evaluations', tenantId] as const,
    grades: (tenantId: string, evaluationId: string) =>
      ['exams', 'grades', tenantId, evaluationId] as const,
    gradingSheet: (tenantId: string, evaluationId: string) =>
      ['exams', 'grading-sheet', tenantId, evaluationId] as const,
  },

  // ── Students ──
  students: {
    all: (tenantId: string) => ['students', tenantId] as const,
    detail: (tenantId: string, studentId: string) =>
      ['students', 'detail', tenantId, studentId] as const,
  },

  // ── Dashboard ──
  dashboard: {
    kpis: (tenantId: string, role: string) =>
      ['dashboard', 'kpis', tenantId, role] as const,
    orion: (tenantId: string) => ['dashboard', 'orion', tenantId] as const,
  },

  // ── Settings ──
  settings: {
    features: (tenantId: string) => ['settings', 'features', tenantId] as const,
    general: (tenantId: string) => ['settings', 'general', tenantId] as const,
    identity: (tenantId: string) => ['settings', 'identity', tenantId] as const,
    roles: (tenantId: string) => ['settings', 'roles', tenantId] as const,
    permissions: (tenantId: string) => ['settings', 'permissions', tenantId] as const,
    academicYears: (tenantId: string) => ['settings', 'academic-years', tenantId] as const,
    education: (tenantId: string) => ['settings', 'education', tenantId] as const,
  },
} as const;
