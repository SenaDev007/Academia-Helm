/**
 * ============================================================================
 * USE ALL CLASSES — Hook React Query partagé pour la liste des classes
 * ============================================================================
 *
 * AVANT : 20 composants faisaient chacun `fetch('/api/all-classes')` dans
 * un useEffect → 20 appels backend au lieu d'1, pas de cache partagé.
 *
 * MAINTENANT : 1 seul hook, cache 2 min partagé entre tous les composants.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface ClassItem {
  id: string;
  name: string;
  code?: string;
  level?: string;
  capacity?: number;
  schoolLevelId?: string;
  language?: string;
  [key: string]: any;
}

async function fetchAllClasses(): Promise<ClassItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('/api/all-classes', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.classes)) return data.classes;
    return [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return [];
    throw err;
  }
}

interface UseAllClassesOptions {
  /** Filtrer par niveau scolaire */
  schoolLevelId?: string;
  /** Filtrer par année scolaire */
  academicYearId?: string;
  /** Filtrer par piste linguistique */
  language?: string;
}

export function useAllClasses(options: UseAllClassesOptions = {}) {
  const { schoolLevelId, academicYearId, language } = options;

  const query = useQuery<ClassItem[]>({
    queryKey: ['all-classes', schoolLevelId, academicYearId, language],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (schoolLevelId && schoolLevelId !== 'ALL') params.set('schoolLevelId', schoolLevelId);
      if (academicYearId) params.set('academicYearId', academicYearId);
      if (language) params.set('language', language);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const url = params.toString()
          ? `/api/all-classes?${params.toString()}`
          : '/api/all-classes';
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.data)) return data.data;
        return [];
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 min (les classes changent plus souvent que les niveaux)
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  return {
    classes: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export default useAllClasses;
