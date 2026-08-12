/**
 * ============================================================================
 * useSaveGrades — Mutation optimiste pour sauvegarder les notes
 * ============================================================================
 *
 * Optimistic UI : les notes sont mises à jour instantanément dans le cache
 * avant la confirmation du serveur. En cas d'erreur, rollback automatique.
 *
 * ⭐ OFFLINE-FIRST : utilise offlineMutation au lieu de fetch() direct.
 *    En offline, l'écriture est sauvegardée dans IndexedDB + outbox pour
 *    synchronisation automatique à la reconnexion.
 * ============================================================================
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { offlineMutation } from '@/lib/offline/offline-fetch';

interface GradeEntry {
  studentId: string;
  scores: Record<string, number | null>;
  computedAverage: number | null;
  isAbsent: boolean;
  comment: string;
}

interface SaveGradesInput {
  evaluationId: string;
  grades: GradeEntry[];
  formula?: string;
  submit?: boolean;
}

interface SaveGradesResult {
  success: boolean;
  [key: string]: any;
}

export function useSaveGrades(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation<SaveGradesResult, Error, SaveGradesInput>({
    mutationFn: async (data: SaveGradesInput) => {
      // ⭐ offlineMutation : en ligne → fetch serveur, hors ligne → IndexedDB + outbox
      const result = await offlineMutation<SaveGradesResult>(
        `/api/exams/evaluations/${data.evaluationId}/grades`,
        'POST',
        { grades: data.grades, formula: data.formula, submit: data.submit },
        { tenantId }
      );
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data ?? { success: true, _offline: true } as SaveGradesResult;
    },

    // ── Optimistic update : les notes sont déjà dans le state local ──
    // On marque simplement le cache comme "saved" sans refetch
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.exams.gradingSheet(tenantId, variables.evaluationId),
      });

      const previousSheet = queryClient.getQueryData(
        queryKeys.exams.gradingSheet(tenantId, variables.evaluationId),
      );

      // Mettre à jour le cache avec les nouvelles notes
      queryClient.setQueryData(
        queryKeys.exams.gradingSheet(tenantId, variables.evaluationId),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            grades: variables.grades,
            _lastSaved: Date.now(),
            _optimistic: true,
          };
        },
      );

      return { previousSheet };
    },

    // ── Rollback ──
    onError: (_err, variables, context) => {
      if (context?.previousSheet) {
        queryClient.setQueryData(
          queryKeys.exams.gradingSheet(tenantId, variables.evaluationId),
          context.previousSheet,
        );
      }
    },

    // ── Succès : invalider pour récupérer les données serveur ──
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.exams.gradingSheet(tenantId, variables.evaluationId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations(tenantId),
      });
    },
  });
}
