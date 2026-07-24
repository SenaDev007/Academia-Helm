/**
 * ============================================================================
 * STUDENTS QUERY KEYS — Factory pour cache invalidation React Query
 * ============================================================================
 */

export const studentsKeys = {
  all: ['students'] as const,
  lists: () => [...studentsKeys.all, 'list'] as const,
  details: () => [...studentsKeys.all, 'detail'] as const,

  list: (params: any) => [...studentsKeys.all, 'list', params] as const,
  detail: (id: string) => [...studentsKeys.all, 'detail', id] as const,
  admissions: (params: any) => [...studentsKeys.all, 'admissions', params] as const,
  absences: (params: any) => [...studentsKeys.all, 'absences', params] as const,
  enrollments: (params: any) => [...studentsKeys.all, 'enrollments', params] as const,
  guardians: (studentId: string) => [...studentsKeys.all, 'guardians', studentId] as const,
  documents: (studentId: string) => [...studentsKeys.all, 'documents', studentId] as const,
  history: (studentId: string) => [...studentsKeys.all, 'history', studentId] as const,
  assignments: (studentId: string) => [...studentsKeys.all, 'assignments', studentId] as const,
  movements: (params: any) => [...studentsKeys.all, 'movements', params] as const,
  audit: (studentId: string) => [...studentsKeys.all, 'audit', studentId] as const,
} as const;
