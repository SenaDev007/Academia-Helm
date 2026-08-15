import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = await getProxyAuthHeaders(request);
  const body = await request.json().catch(() => ({}));
  const apiBaseUrl = getApiBaseUrlForRoutes();
  const res = await fetchWithTimeout(normalizeApiUrl(`${apiBaseUrl}/discipline/conduct/sanctions/${id}`), {
    method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  }, 15000);
  return NextResponse.json(await res.json(), { status: res.status });
}
