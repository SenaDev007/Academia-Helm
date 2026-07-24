import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/payment-config
 * Récupère la config de paiement en ligne du tenant (clés masquées).
 */
export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/payment-config`), { headers , cache: 'no-store' }, 15000);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/finance/payment-config
 * Crée ou met à jour la config de paiement en ligne.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(normalizeApiUrl(`${API_URL}/finance/payment-config`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error saving payment config:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
