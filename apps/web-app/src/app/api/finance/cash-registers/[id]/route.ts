import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = await getProxyAuthHeaders(request);
  const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/cash-registers/${id}`), { headers , cache: 'no-store' }, 15000);
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const r = await fetch(normalizeApiUrl(`${API_URL}/finance/cash-registers/${id}`), { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = await getProxyAuthHeaders(request);
  const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/cash-registers/${id}`), { method: 'DELETE', headers , cache: 'no-store' }, 15000);
  if (r.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
