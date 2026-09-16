import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/payments/fedapay/initiate
 * Stocke les métadonnées d'initiation de paiement AVANT l'ouverture du widget
 * Fedapay (portail parent « payer les frais » + encaissements boutique).
 *
 * Backend : fedapay.controller.ts:41 @Post('initiate') (JwtAuthGuard).
 *
 * Avant cette route BFF, le fetch frontend (lib/parent/fedapay-checkout.ts:48
 * et portal/parent/pay-fees) recevait un 404 → « Échec du paiement » côté
 * parent, alors que le backend était prêt.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/payments/fedapay/initiate`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      20000,
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
