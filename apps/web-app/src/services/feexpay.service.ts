/**
 * FeexPay Service — Frontend client for FeexPay configuration & payments
 *
 * Calls the BFF catch-all at /api/billing/feexpay/*
 * which proxies to NestJS FeexPayController.
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export interface FeexPayConfig {
  configured: boolean;
  shopId: string | null;
  hasApiKey: boolean;
  maskedApiKey: string | null;
  schoolName: string;
  globalConfigured: boolean;
}

export interface FeexPayTestResult {
  ok: boolean;
  error?: string;
  balance?: any;
}

export interface SchoolFeeCashPaymentRequest {
  studentId: string;
  studentFeeId?: string;
  amount: number;
  feeType?: string;
  academicYearId?: string;
  schoolLevelId: string;
  description?: string;
  createdBy?: string;
}

export interface SchoolFeeMobilePaymentRequest extends SchoolFeeCashPaymentRequest {
  phoneNumber: string;
  operator: string;
  payerFirstName?: string;
  payerLastName?: string;
}

export interface SchoolFeePaymentResult {
  success: boolean;
  paymentId?: string;
  feexPayReference?: string;
  method: string;
  status: string;
  amount?: number;
  message?: string;
}

async function feexPayFetch<T>(
  path: string,
  options?: { method?: string; body?: any },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const res = await fetch(`/api/billing/feexpay/${path.replace(/^\//, '')}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && {
      body: JSON.stringify(options.body),
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) {
      try {
        err = JSON.parse(text);
      } catch {
        err = {};
      }
    }
    throw new Error(err.message ?? err.error ?? res.statusText ?? 'Erreur réseau');
  }

  if (!text.trim()) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse invalide du serveur');
  }
}

export const feexPayService = {
  /** Récupère la config FeexPay du tenant (API key masquée) */
  getConfig: () => feexPayFetch<FeexPayConfig>('school-config'),

  /** Sauvegarde Shop ID + API Key (chiffrée côté backend) */
  saveConfig: (shopId: string, apiKey?: string) =>
    feexPayFetch<FeexPayConfig>('school-config', {
      method: 'PUT',
      body: { feexpayShopId: shopId, feexpayApiKey: apiKey },
    }),

  /** Teste la connexion FeexPay du tenant */
  testConnection: () =>
    feexPayFetch<FeexPayTestResult>('school-config/test', { method: 'POST' }),

  /** Supprime la config FeexPay du tenant */
  deleteConfig: () =>
    feexPayFetch<{ success: boolean; message: string }>('school-config', {
      method: 'DELETE',
    }),

  /** Vérifie si FeexPay est configuré (léger) */
  getStatus: () =>
    feexPayFetch<{ configured: boolean }>('school-config/status'),

  // ─── Frais scolaires ───

  /** Paiement en espèces (toujours disponible) */
  payCash: (data: SchoolFeeCashPaymentRequest) =>
    feexPayFetch<SchoolFeePaymentResult>('school-fees/pay-cash', {
      method: 'POST',
      body: data,
    }),

  /** Paiement Mobile Money (requiert FeexPay configuré) */
  payMobile: (data: SchoolFeeMobilePaymentRequest) =>
    feexPayFetch<SchoolFeePaymentResult>('school-fees/pay-mobile', {
      method: 'POST',
      body: data,
    }),

  /** Vérifie le statut d'un paiement Mobile Money */
  getPaymentStatus: (reference: string) =>
    feexPayFetch<SchoolFeePaymentResult>(
      `school-fees/payment-status/${reference}`,
    ),
};
