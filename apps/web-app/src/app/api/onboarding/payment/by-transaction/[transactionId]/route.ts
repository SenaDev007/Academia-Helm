/**
 * ============================================================================
 * ONBOARDING PAYMENT LOOKUP BY FEDAPAY TRANSACTION ID
 * ============================================================================
 *
 * Proxy BFF pour retrouver un paymentId à partir de l'ID numérique FedaPay.
 *
 * FedaPay redirige après paiement vers /signup/confirmation?id=470323&status=approved
 * SANS préserver les query params d'origine (draftId, paymentId).
 * Le frontend utilise cet endpoint pour retrouver le paymentId.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> },
) {
  const { transactionId } = await params;

  if (!transactionId) {
    return NextResponse.json(
      { error: 'transactionId is required' },
      { status: 400 },
    );
  }

  const apiBaseUrl = getApiBaseUrlForRoutes();
  const lookupUrl = `${apiBaseUrl}/onboarding/payment/by-transaction/${transactionId}`;

  try {
    const response = await fetch(normalizeApiUrl(lookupUrl), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Payment Lookup] Error:', error);
    return NextResponse.json(
      {
        found: false,
        paymentId: null,
        error: error.message || 'Erreur lors de la recherche du paiement',
      },
      { status: 500 },
    );
  }
}
