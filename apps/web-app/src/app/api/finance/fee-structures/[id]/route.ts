import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

// ⭐ FIX (sept. 2026 — même bug que POST /fee-structures) : la modification d'un
//    frais déclenche elle aussi le recalcul synchrone des comptes élèves
//    (≈ 21,8 s avant parallélisation backend) → fonction Vercel tuée avant la
//    réponse → le modal d'édition ne se fermait pas alors que l'enregistrement
//    était bien pris en compte. → maxDuration=60 + timeout 55 s SANS retry
//    (une mutation n'est jamais rejouée automatiquement — sinon frais en double).
export const maxDuration = 60;

const MUTATION_TIMEOUT_MS = 55_000;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/fee-structures/${id}`), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    // ⚠️ fetch PLAIN + AbortSignal (PAS fetchWithTimeout) : pas de retry auto
    // sur une mutation (sinon double application de la modification).
    const response = await fetch(normalizeApiUrl(`${API_URL}/finance/fee-structures/${id}`), {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || e?.name === 'TimeoutError' || /timeout|abort/i.test(e?.message ?? '');
    return NextResponse.json(
      {
        message: isTimeout
          ? "La modification prend plus de temps que prévu (recalcul des comptes élèves). Réessayez — si le frais affiche déjà les nouvelles valeurs, il a bien été modifié."
          : 'Internal server error',
        error: isTimeout ? 'UPSTREAM_TIMEOUT' : 'Internal server error',
      },
      { status: 504 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/fee-structures/${id}`), {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    }, 15000);
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
