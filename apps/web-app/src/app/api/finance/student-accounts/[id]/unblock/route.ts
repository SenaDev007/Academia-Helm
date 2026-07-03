import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const r = await fetch(normalizeApiUrl(`${API_URL}/api/finance/accounts/${id}/unblock`), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
