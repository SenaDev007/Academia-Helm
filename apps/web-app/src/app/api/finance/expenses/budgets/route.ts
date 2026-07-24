import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.searchParams.toString();
  const headers = await getProxyAuthHeaders(request);
  const res = await fetch(normalizeApiUrl(`${getApiBaseUrlForRoutes()}/finance/expenses/budgets${qs ? `?${qs}` : ''}`), { headers, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const res = await fetch(normalizeApiUrl(`${getApiBaseUrlForRoutes()}/finance/expenses/budgets`), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
