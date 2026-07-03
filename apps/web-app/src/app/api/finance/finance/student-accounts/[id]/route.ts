import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = await getProxyAuthHeaders(request);
  const r = await fetch(normalizeApiUrl(`${API_URL}/finance/accounts/${id}`), { headers });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
