import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';


const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    const { reference } = await params;
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/payments/fedapay/${encodeURIComponent(reference)}/status`),
      { headers },
    15000);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error checking Fedapay status:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
