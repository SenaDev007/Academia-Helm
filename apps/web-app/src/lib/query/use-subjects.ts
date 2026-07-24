/**
 * ============================================================================
 * USE SUBJECTS — Hook React Query partagé pour les matières
 * ============================================================================
 *
 * Récupère les matières d'une année scolaire.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { pedagogyService } from '@/services/pedagogy.service';

export interface Subject {
  id: string;
  name: string;
  code?: string;
  coefficient?: number;
  schoolLevelId?: string;
  [key: string]: any;
}

export function useSubjects(academicYearId: string | null | undefined) {
  return useQuery<Subject[]>({
    queryKey: ['subjects', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      const data = await pedagogyService.getSubjects(academicYearId);
      return Array.isArray(data) ? data : (data?.data ?? []);
    },
    enabled: !!academicYearId,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export default useSubjects;
