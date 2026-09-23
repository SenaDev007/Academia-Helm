import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/transactions${qs ? `?${qs}` : ''}`), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    // ⭐ FIX PERF 2026-09-07 : AVANT, fetch() brut SANS TIMEOUT.
    // Une écriture d'encaissement sur un backend en redémarrage/cold start
    // pendait jusqu'à ce que Vercel tue la fonction (504 FUNCTION_INVOCATION-
    // TIMEOUT) → « délai d'attente dépassé » côté utilisateur alors que le
    // backend pouvait avoir COMMIS la transaction → double encaissement au
    // retry. Maintenant : 30s (couvre redémarrage Railway + cold start Neon)
    // + 1 retry automatique sur 502/503/504 (intégré à fetchWithTimeout —
    // ces codes = requête non traitée par le backend, retry SÛR).
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/transactions`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || /timeout/i.test(String(e?.message || ''));
    return NextResponse.json(
      { message: isTimeout ? "Délai d'attente dépassé — l'opération n'a pas abouti, veuillez réessayer." : 'Internal server error' },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    // ⭐ FIX PERF 2026-09-07 : même correction que POST (timeout + retry passerelle)
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/transactions`), {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || /timeout/i.test(String(e?.message || ''));
    return NextResponse.json(
      { message: isTimeout ? "Délai d'attente dépassé — l'opération n'a pas abouti, veuillez réessayer." : 'Internal server error' },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
