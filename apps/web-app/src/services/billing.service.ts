/**
 * Billing Service
 *
 * Service léger qui interagit avec l'API backend de facturation.
 * Toute la logique métier (numérotation, archivage, PDF) reste côté backend.
 */

import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { Invoice, Payment, Receipt } from '@/types';

export interface BillingSummary {
  invoices: Invoice[];
  payments: Payment[];
  receipts: Receipt[];
}

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Récupère l'historique complet de facturation du tenant courant.
 */
export async function getBillingHistory(): Promise<BillingSummary> {
  return offlineFetch<BillingSummary>('/billing/history', 'invoices', {
    tenantId: getTenantId(),
  });
}

/**
 * Récupère les factures uniquement.
 */
export async function getInvoices(): Promise<Invoice[]> {
  return offlineFetch<Invoice[]>('/billing/invoices', 'invoices', {
    tenantId: getTenantId(),
  });
}

/**
 * Récupère les reçus uniquement.
 */
export async function getReceipts(): Promise<Receipt[]> {
  return offlineFetch<Receipt[]>('/billing/receipts', 'payments', {
    tenantId: getTenantId(),
  });
}
