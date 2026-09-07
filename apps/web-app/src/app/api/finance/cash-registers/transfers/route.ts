import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';


const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/cash-registers/transfers
 * Historique des transferts inter-caisses.
 * Query params : cashRegisterId?, dateFrom?, dateTo?, limit?
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/cash-registers/transfers${qs ? `?${qs}` : ''}`),
      { headers },
    15000);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
