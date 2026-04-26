import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const countryCode = request.nextUrl.searchParams.get('countryCode') || 'BJ';
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/identifiers/generate-bulk?countryCode=${countryCode}`),
      { method: 'POST', headers, body: JSON.stringify(body) }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error generating bulk matricules:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
