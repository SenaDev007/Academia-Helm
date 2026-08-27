import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    // ⭐ NO CACHE — les élèves et leurs guardians (phone, email, etc.) sont
    //    fréquemment modifiés. Sans 'no-store', Vercel CDN sert une réponse
    //    stale jusqu'à 60s + 5min stale-while-revalidate → l'utilisateur ne
    //    voit pas ses modifications après édition dans l'onglet Inscriptions.
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/students`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
