import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/exports/transactions/pdf${qs ? `?${qs}` : ''}`), { headers , cache: 'no-store' }, 15000);
    const contentType = r.headers.get('content-type') || 'application/pdf';
    const buffer = Buffer.from(await r.arrayBuffer());
    return new NextResponse(buffer, { status: 200, headers: { 'Content-Type': contentType, 'Content-Disposition': r.headers.get('content-disposition') || 'inline' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
