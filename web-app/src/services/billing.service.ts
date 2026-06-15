/**
 * Billing Service
 *
 * Service léger qui interagit avec l'API backend de facturation.
 * Toute la logique métier (numérotation, archivage, PDF) reste côté backend.
 */

import { apiClient } from '@/lib/api/client';
import type { Invoice, Payment, Receipt } from '@/types';

export interface BillingSummary {
  invoices: Invoice[];
  payments: Payment[];
  receipts: Receipt[];
}

/**
 * Récupère l'historique complet de facturation du tenant courant.
 */
export async function getBillingHistory(): Promise<BillingSummary> {
  const response = await apiClient.get<BillingSummary>('/billing/history');
  return response.data;
}

/**
 * Récupère les factures uniquement.
 */
export async function getInvoices(): Promise<Invoice[]> {
  const response = await apiClient.get<Invoice[]>('/billing/invoices');
  return response.data;
}

/**
 * Récupère les reçus uniquement.
 */
export async function getReceipts(): Promise<Receipt[]> {
  const response = await apiClient.get<Receipt[]>('/billing/receipts');
  return response.data;
}


