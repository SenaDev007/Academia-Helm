/**
 * ============================================================================
 * USE ACADEMIC PERIODS — Hook React Query partagé pour les périodes (trimestres)
 * ============================================================================
 *
 * Récupère les trimestres d'une année scolaire depuis la table academic_periods.
 * Utilisé par le module examen (sélecteur de période) et les bulletins.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getAcademicYearPeriods } from '@/services/settings.service';

export interface AcademicPeriod {
  id: string;
  name: string;
  type: string;
  periodOrder: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
}

export function useAcademicPeriods(academicYearId: string | null | undefined) {
  return useQuery<AcademicPeriod[]>({
    queryKey: ['academic-periods', academicYearId],
    queryFn: async () => {
      if (!academicYearId) return [];
      const data = await getAcademicYearPeriods(academicYearId);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!academicYearId,
    staleTime: 5 * 60 * 1000, // 5 min (les périodes changent rarement)
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

/** Retourne la période active (trimestre courant) */
export function useCurrentPeriod(academicYearId: string | null | undefined) {
  const { data: periods, ...rest } = useAcademicPeriods(academicYearId);
  const currentPeriod = (periods || []).find(p => p.isActive && !p.isClosed) || (periods || [])[0];
  return { currentPeriod, periods: periods || [], ...rest };
}

export default useAcademicPeriods;
