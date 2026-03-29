/**
 * Clés TanStack Query — tableau de bord et agrégats pédagogie (par année scolaire).
 */
export const pedagogyKeys = {
  all: ['pedagogy'] as const,
  controlDashboard: (academicYearId: string) =>
    [...pedagogyKeys.all, 'control', 'dashboard', academicYearId] as const,
  controlSnapshots: (academicYearId: string) =>
    [...pedagogyKeys.all, 'control', 'snapshots', academicYearId] as const,
  orionAdvancedDashboard: (academicYearId: string) =>
    [...pedagogyKeys.all, 'orion-advanced', 'dashboard', academicYearId] as const,
  orionKpis: (academicYearId: string) =>
    [...pedagogyKeys.all, 'orion', 'kpis', academicYearId] as const,
  structureLevels: (academicYearId: string) =>
    [...pedagogyKeys.all, 'academic-structure', 'levels', academicYearId] as const,
  subjectsList: () => [...pedagogyKeys.all, 'subjects'] as const,
  timetablesList: (academicYearId: string) =>
    [...pedagogyKeys.all, 'timetables', academicYearId] as const,
  roomsList: (academicYearId: string) => [...pedagogyKeys.all, 'rooms', academicYearId] as const,
};
