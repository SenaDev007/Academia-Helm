import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const res = await fetchWithTimeout(normalizeApiUrl(`${getApiBaseUrlForRoutes()}/finance/fee-regimes/${id}`), {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 30000);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = await getProxyAuthHeaders(request);
  const res = await fetchWithTimeout(normalizeApiUrl(`${getApiBaseUrlForRoutes()}/finance/fee-regimes/${id}`), {
    method: 'DELETE',
    headers,
  }, 30000);
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
