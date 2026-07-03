import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qs = request.nextUrl.searchParams.toString();
  const headers = await getProxyAuthHeaders(request);
  const r = await fetch(normalizeApiUrl(`${API_URL}/api/finance/cash-registers/${id}/stats${qs ? `?${qs}` : ''}`), { headers });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
