/**
 * ============================================================================
 * Parent Portal — React Query hooks
 * ============================================================================
 *
 * Pattern identique à pedagogy-hooks.ts (useMyClasses) :
 *   - Query key factory pour invalidation ciblée
 *   - useQuery avec staleTime 5min, gcTime 1h
 *   - placeholderData: keepPreviousData (pas de flash)
 *
 * Hooks exposés :
 *   - useParentChildren(academicYearId) — liste des enfants + solde + enseignant
 *   - useParentChildDetail(studentId, academicYearId) — détail d'un enfant
 *   - useParentToday(studentId, academicYearId) — suivi journalier
 *   - useParentAttendance(studentId, academicYearId) — assiduité
 *   - useParentResults(studentId, academicYearId) — bulletins/résultats
 * ============================================================================
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';

const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 min
const DEFAULT_GC_TIME = 60 * 60 * 1000;   // 1 h

// ─── Query key factory ─────────────────────────────────────────────────────

export const parentKeys = {
  all: ['parent'] as const,
  children: (academicYearId: string) => [...parentKeys.all, 'children', academicYearId] as const,
  childDetail: (studentId: string, academicYearId: string) =>
    [...parentKeys.all, 'child', studentId, academicYearId] as const,
  today: (studentId: string, academicYearId: string) =>
    [...parentKeys.all, 'today', studentId, academicYearId] as const,
  attendance: (studentId: string, academicYearId: string) =>
    [...parentKeys.all, 'attendance', studentId, academicYearId] as const,
  results: (studentId: string, academicYearId: string) =>
    [...parentKeys.all, 'results', studentId, academicYearId] as const,
};

// ─── Fetch helpers ──────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Liste des enfants du parent connecté.
 * Pattern identique à useMyClasses (teacher).
 */
export function useParentChildren(academicYearId: string | undefined) {
  return useQuery({
    queryKey: parentKeys.children(academicYearId || ''),
    queryFn: () => fetchJson(`/api/parent/children?academicYearId=${academicYearId}`),
    enabled: !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

/**
 * Détail d'un enfant (infos + assiduité + scolarité + enseignant).
 */
export function useParentChildDetail(
  studentId: string | undefined,
  academicYearId: string | undefined,
) {
  return useQuery({
    queryKey: parentKeys.childDetail(studentId || '', academicYearId || ''),
    queryFn: () =>
      fetchJson(`/api/parent/children/${studentId}?academicYearId=${academicYearId}`),
    enabled: !!studentId && !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

/**
 * Suivi journalier d'un enfant (présence + cours + devoirs du jour).
 */
export function useParentToday(
  studentId: string | undefined,
  academicYearId: string | undefined,
) {
  return useQuery({
    queryKey: parentKeys.today(studentId || '', academicYearId || ''),
    queryFn: () =>
      fetchJson(`/api/parent/today/${studentId}?academicYearId=${academicYearId}`),
    enabled: !!studentId && !!academicYearId,
    staleTime: 2 * 60 * 1000, // 2 min — données temps réel
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

/**
 * Assiduité d'un enfant (historique de présence).
 */
export function useParentAttendance(
  studentId: string | undefined,
  academicYearId: string | undefined,
) {
  return useQuery({
    queryKey: parentKeys.attendance(studentId || '', academicYearId || ''),
    queryFn: () =>
      fetchJson(`/api/parent/attendance/${studentId}?academicYearId=${academicYearId}`),
    enabled: !!studentId && !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

/**
 * Bulletins / Résultats d'un enfant.
 */
export function useParentResults(
  studentId: string | undefined,
  academicYearId: string | undefined,
) {
  return useQuery({
    queryKey: parentKeys.results(studentId || '', academicYearId || ''),
    queryFn: () =>
      fetchJson(`/api/parent/results/${studentId}?academicYearId=${academicYearId}`),
    enabled: !!studentId && !!academicYearId,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}
