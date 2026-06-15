/**
 * ============================================================================
 * useRecordPayment — Mutation optimiste pour enregistrer un paiement
 * ============================================================================
 *
 * Optimistic UI : le paiement apparaît instantanément dans la liste
 * avant la confirmation du serveur. En cas d'erreur, rollback automatique.
 *
 * Utilise @tanstack/react-query useMutation avec onMutate/onError/onSuccess.
 * ============================================================================
 */

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/query-keys';
import { FinanceService } from '@/services/finance.service';

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
  const financeService = new FinanceService();

  return useMutation<PaymentResult, Error, PaymentInput>({
    mutationFn: async (data: PaymentInput) => {
      const result = await financeService.createTransaction(data);
      return result;
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
