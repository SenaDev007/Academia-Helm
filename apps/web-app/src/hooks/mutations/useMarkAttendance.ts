/**
 * ============================================================================
 * useMarkAttendance — Mutation optimiste pour marquer la présence
 * ============================================================================
 *
 * Optimistic UI : le statut de présence est mis à jour instantanément
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

interface AttendanceInput {
  academicYearId: string;
  staffId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  hoursWorked: number;
  notes?: string;
}

interface AttendanceResult {
  id: string;
  [key: string]: any;
}

export function useMarkAttendance(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation<AttendanceResult, Error, AttendanceInput>({
    mutationFn: async (data: AttendanceInput) => {
      // ⭐ offlineMutation : en ligne → fetch serveur, hors ligne → IndexedDB + outbox
      const result = await offlineMutation<AttendanceResult>(
        '/api/attendance',
        'POST',
        data,
        { tenantId }
      );
      if (result.error) {
        throw new Error(result.error);
      }
      // Si offline, result.data peut être undefined → on retourne une version optimiste
      return result.data ?? { id: `local-${Date.now()}`, ...data, _offline: true } as AttendanceResult;
    },

    // ── Optimistic update ──
    onMutate: async (newAttendance) => {
      // Annuler les queries en cours
      await queryClient.cancelQueries({
        queryKey: queryKeys.attendance.byStaff(tenantId, newAttendance.staffId),
      });

      // Snapshot pour rollback
      const previousAttendance = queryClient.getQueryData(
        queryKeys.attendance.byStaff(tenantId, newAttendance.staffId),
      );

      // Mettre à jour optimistement
      queryClient.setQueryData(
        queryKeys.attendance.byStaff(tenantId, newAttendance.staffId),
        (old: any) => {
          if (!old) return old;
          const optimisticRecord = {
            id: `temp-${Date.now()}`,
            ...newAttendance,
            createdAt: new Date().toISOString(),
            _optimistic: true,
          };

          if (Array.isArray(old)) {
            return [optimisticRecord, ...old];
          }
          if (old.data && Array.isArray(old.data)) {
            return { ...old, data: [optimisticRecord, ...old.data] };
          }
          return old;
        },
      );

      return { previousAttendance };
    },

    // ── Rollback ──
    onError: (_err, variables, context) => {
      if (context?.previousAttendance) {
        queryClient.setQueryData(
          queryKeys.attendance.byStaff(tenantId, variables.staffId),
          context.previousAttendance,
        );
      }
    },

    // ── Succès : invalider ──
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.byStaff(tenantId, variables.staffId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.attendance.stats(tenantId),
      });
    },
  });
}
