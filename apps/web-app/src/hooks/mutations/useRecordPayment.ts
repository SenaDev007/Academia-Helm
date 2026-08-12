/**
 * ============================================================================
 * useRecordPayment — Mutation optimiste pour enregistrer un paiement
 * ============================================================================
 *
 * Optimistic UI : le paiement apparaît instantanément dans la liste
 * avant la confirmation du serveur. En cas d'erreur, rollback automatique.
 *
 * ⭐ OFFLINE-FIRST : utilise offlineMutation au lieu de fetch() direct.
 *    En offline, l'écriture est sauvegardée dans IndexedDB + outbox pour
 *    synchronisation automatique à la reconnexion.
 *
 * Utilise @tanstack/react-query useMutation avec onMutate/onError/onSuccess.
 * ============================================================================
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { offlineMutation } from '@/lib/offline/offline-fetch';

interface PaymentInput {
  academicYearId: string;
  studentAccountId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  description?: string;
}

interface PaymentResult {
  id: string;
  [key: string]: any;
}

export function useRecordPayment(tenantId: string, academicYearId: string) {
  const queryClient = useQueryClient();

  return useMutation<PaymentResult, Error, PaymentInput>({
    mutationFn: async (data: PaymentInput) => {
      // ⭐ offlineMutation : en ligne → fetch serveur, hors ligne → IndexedDB + outbox
      const result = await offlineMutation<PaymentResult>(
        '/api/finance/transactions',
        'POST',
        data,
        { tenantId }
      );
      if (result.error) {
        throw new Error(result.error);
      }
      return result.data ?? { id: `local-${Date.now()}`, ...data, _offline: true } as PaymentResult;
    },

    // ── Optimistic update : ajouter le paiement avant la réponse serveur ──
    onMutate: async (newPayment) => {
      // Annuler les queries en cours pour éviter les refetch qui écrasent l'optimistic update
      await queryClient.cancelQueries({
        queryKey: queryKeys.finance.transactions(tenantId, academicYearId),
      });

      // Snapshot de la liste actuelle pour rollback
      const previousTransactions = queryClient.getQueryData(
        queryKeys.finance.transactions(tenantId, academicYearId),
      );

      // Optimistic update : pré-pendre le nouveau paiement
      queryClient.setQueryData(
        queryKeys.finance.transactions(tenantId, academicYearId),
        (old: any) => {
          if (!old) return old;
          const optimisticPayment = {
            id: `temp-${Date.now()}`,
            ...newPayment,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            _optimistic: true,
          };

          if (Array.isArray(old)) {
            return [optimisticPayment, ...old];
          }
          if (old.data && Array.isArray(old.data)) {
            return { ...old, data: [optimisticPayment, ...old.data] };
          }
          return old;
        },
      );

      return { previousTransactions };
    },

    // ── Rollback en cas d'erreur ──
    onError: (_err, _newPayment, context) => {
      if (context?.previousTransactions) {
        queryClient.setQueryData(
          queryKeys.finance.transactions(tenantId, academicYearId),
          context.previousTransactions,
        );
      }
    },

    // ── Succès : invalider pour récupérer la vraie donnée serveur ──
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.transactions(tenantId, academicYearId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.summary(tenantId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.kpis(tenantId, 'admin'),
      });
    },
  });
}
