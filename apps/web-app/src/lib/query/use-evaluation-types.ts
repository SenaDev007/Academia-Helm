/**
 * ============================================================================
 * USE EVALUATION TYPES — Hook React Query partagé pour les types d'évaluation
 * ============================================================================
 *
 * Récupère les types d'évaluation (Devoir, Interrogation, Composition, etc.)
 * filtrés par niveau scolaire.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { institutionalExamsService } from '@/services/institutional-exams.service';

export interface EvaluationType {
  id: string;
  name: string;
  code?: string;
  defaultMaxScore: number;
  defaultCoefficient: number;
  schoolLevelId?: string | null;
  isSystem?: boolean;
}

export function useEvaluationTypes(schoolLevelId?: string) {
  return useQuery<EvaluationType[]>({
    queryKey: ['evaluation-types', schoolLevelId],
    queryFn: async () => {
      const data = await institutionalExamsService.getEvaluationTypes(schoolLevelId);
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export default useEvaluationTypes;
