import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ ÉDITION D'UN ENCAISSEMENT (promoteur uniquement — garde de rôle côté
 * api-server). Proxifie PATCH /finance/transactions/:id.
 * Timeout 30 s (couvre recalcul soldes + imputations + audit + triggers).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/transactions/${id}`),
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      30000,
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || /timeout/i.test(String(e?.message || ''));
    return NextResponse.json(
      {
        message: isTimeout
          ? "Délai d'attente dépassé — la modification n'a probablement pas été enregistrée. Rechargez la page pour vérifier avant de réessayer."
          : 'Internal server error',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}

/**
 * ⭐ SUPPRESSION D'UN ENCAISSEMENT (promoteur uniquement — garde de rôle côté
 * api-server). Proxifie DELETE /finance/transactions/:id.
 * Le motif transite dans le body (avec fallback query param ?reason= pour les
 * clients qui ne peuvent pas envoyer de body en DELETE).
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const reason = body?.reason ?? request.nextUrl.searchParams.get('reason') ?? 'Non précisé';
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/transactions/${id}`),
      {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
        cache: 'no-store',
      },
      30000,
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || /timeout/i.test(String(e?.message || ''));
    return NextResponse.json(
      {
        message: isTimeout
          ? "Délai d'attente dépassé — la suppression n'a probablement pas été effectuée. Rechargez la page pour vérifier avant de réessayer."
          : 'Internal server error',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
