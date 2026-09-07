import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.qrPayload || !body.qrHash) {
      return NextResponse.json(
        { error: 'qrPayload and qrHash are required' },
        { status: 400 }
      );
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/students/id-cards/verify-qr`), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error verifying QR code:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
