import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/payments/fedapay/webhook?tenantId=<uuid>
 * Webhook callback Fedapay — appelé par les serveurs FedaPay (PAS d'auth JWT :
 * aucun cookie ni Authorization ; le tenantId passe en query string).
 *
 * Backend : fedapay.controller.ts:82 @Post('webhook') — sans @UseGuards.
 *
 * Avant cette route BFF, l'URL de webhook affichée dans Paramètres >
 * Configuration paiements (PaymentConfigSection) renvoyait 404 → aucune
 * réconciliation automatique des paiements en ligne.
 */
export async function POST(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.toString();
    const body = await request.json().catch(() => ({}));
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/payments/fedapay/webhook${q ? `?${q}` : ''}`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
