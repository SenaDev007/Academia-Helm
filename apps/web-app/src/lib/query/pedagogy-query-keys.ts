/**
 * ============================================================================
 * PEDAGOGY QUERY KEYS — Factory pour cache invalidation React Query
 * ============================================================================
 */

export const pedagogyKeys = {
  all: ['pedagogy'] as const,
  director: () => [...pedagogyKeys.all, 'director'] as const,

  // Director dashboard
  dashboard: (academicYearId: string) =>
    [...pedagogyKeys.director(), 'dashboard', academicYearId] as const,

  // Director pending lists
  pendingCahierJournals: (academicYearId: string) =>
    [...pedagogyKeys.director(), 'pending-cahier-journals', academicYearId] as const,
  pendingFiches: (academicYearId: string) =>
    [...pedagogyKeys.director(), 'pending-fiches', academicYearId] as const,
  pendingRegisters: (academicYearId: string) =>
    [...pedagogyKeys.director(), 'pending-registers', academicYearId] as const,
  pendingEvaluations: (academicYearId: string) =>
    [...pedagogyKeys.director(), 'pending-evaluations', academicYearId] as const,
  pendingCahierTextes: (academicYearId: string) =>
    [...pedagogyKeys.director(), 'pending-cahier-textes', academicYearId] as const,

  // Director details
  cahierJournalDetail: (id: string) =>
    [...pedagogyKeys.director(), 'cahier-journal', id] as const,
  ficheDetail: (id: string) =>
    [...pedagogyKeys.director(), 'fiche', id] as const,
  registerDetail: (id: string) =>
    [...pedagogyKeys.director(), 'register', id] as const,
  evaluationDetail: (id: string) =>
    [...pedagogyKeys.director(), 'evaluation', id] as const,
  cahierTexteDetail: (id: string) =>
    [...pedagogyKeys.director(), 'cahier-texte', id] as const,

  // Teacher
  myClasses: (teacherId: string, academicYearId: string) =>
    [...pedagogyKeys.all, 'my-classes', teacherId, academicYearId] as const,
  attendanceRegister: (params: any) =>
    [...pedagogyKeys.all, 'attendance-register', params] as const,
  monthlyEvaluation: (params: any) =>
    [...pedagogyKeys.all, 'monthly-evaluation', params] as const,
  monthlySummary: (academicYearId: string, classId: string) =>
    [...pedagogyKeys.all, 'monthly-summary', academicYearId, classId] as const,
  availableSubjects: (academicYearId: string, classId: string, teacherId: string) =>
    [...pedagogyKeys.all, 'available-subjects', academicYearId, classId, teacherId] as const,
} as const;
