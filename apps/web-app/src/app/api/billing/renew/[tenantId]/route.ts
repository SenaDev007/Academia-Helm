/**
 * BFF route: POST /api/billing/renew/:tenantId
 * Proxy vers le backend pour renouveler l'abonnement d'une école
 * (réactivation après paiement — lève le mode lecture seule).
 * ⭐ Route manquante (404) : le bouton « Renouveler » de la page
 *    Facturation / du bandeau de suspension ne fonctionnait pas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const body = await request.json().catch(() => ({}));
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(`${apiBaseUrl}/billing/renew/${tenantId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to renew subscription', message: error.message },
      { status: 500 },
    );
  }
}
