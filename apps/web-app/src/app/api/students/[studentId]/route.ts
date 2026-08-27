import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

// ⭐ NO CACHE — les élèves et leurs guardians (phone, email, etc.) sont
//    fréquemment modifiés. Sans 'no-store', Vercel CDN sert une réponse
//    stale jusqu'à 60s + 5min stale-while-revalidate → l'utilisateur ne
//    voit pas ses modifications après édition dans l'onglet Inscriptions.
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/students/${studentId}`), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: NO_CACHE_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/students/${studentId}`), {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: NO_CACHE_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/students/${studentId}`), {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: NO_CACHE_HEADERS });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
