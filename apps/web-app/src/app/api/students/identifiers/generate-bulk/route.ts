import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const countryCode = request.nextUrl.searchParams.get('countryCode') || 'BJ';
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/identifiers/generate-bulk?countryCode=${countryCode}`),
      { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    , 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error generating bulk matricules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
