import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

// GET /api/discipline/conduct/settings → proxy vers GET /discipline/conduct/settings
export async function GET(request: NextRequest) {
  const headers = await getProxyAuthHeaders(request);
  const { searchParams } = new URL(request.url);
  const apiBaseUrl = getApiBaseUrlForRoutes();
  const url = new URL(`${apiBaseUrl}/discipline/conduct/settings`);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));
  const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
  return NextResponse.json(await res.json(), { status: res.status });
}

// PUT /api/discipline/conduct/settings → proxy vers PUT /discipline/conduct/settings
export async function PUT(request: NextRequest) {
  const headers = await getProxyAuthHeaders(request);
  const body = await request.json();
  const apiBaseUrl = getApiBaseUrlForRoutes();
  const url = new URL(`${apiBaseUrl}/discipline/conduct/settings`);
  const res = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    cache: 'no-store',
  }, 15000);
  return NextResponse.json(await res.json(), { status: res.status });
}
