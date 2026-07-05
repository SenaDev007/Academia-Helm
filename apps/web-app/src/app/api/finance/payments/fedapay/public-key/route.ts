import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(normalizeApiUrl(`${API_URL}/finance/payments/fedapay/public-key`), { headers });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error fetching Fedapay public key:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
