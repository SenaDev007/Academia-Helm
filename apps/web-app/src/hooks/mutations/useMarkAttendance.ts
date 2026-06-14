/**
 * ============================================================================
 * useMarkAttendance — Mutation optimiste pour marquer la présence
 * ============================================================================
 *
 * Optimistic UI : le statut de présence est mis à jour instantanément
 * avant la confirmation du serveur. En cas d'erreur, rollback automatique.
 * ============================================================================
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';

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
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
        throw new Error(error.message || `Erreur ${response.status}`);
      }
      return response.json();
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
