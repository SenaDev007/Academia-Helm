/**
 * ============================================================================
 * USE SCHOOL LEVELS — Hook React Query partagé pour les niveaux scolaires
 * ============================================================================
 *
 * AVANT : 18 composants faisaient chacun `fetch('/api/school-levels')` dans
 * un useEffect → 18 appels backend au lieu d'1, pas de cache partagé.
 *
 * MAINTENANT : 1 seul hook, cache 5 min partagé entre tous les composants.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface SchoolLevel {
  id: string;
  code: string;
  label: string;
  isActive: boolean;
  schoolLevelId?: string | null;
}

async function fetchSchoolLevels(): Promise<SchoolLevel[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('/api/school-levels', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return [];
    throw err;
  }
}

export function useSchoolLevelsQuery() {
  return useQuery<SchoolLevel[]>({
    queryKey: ['school-levels'],
    queryFn: fetchSchoolLevels,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export default useSchoolLevelsQuery;
