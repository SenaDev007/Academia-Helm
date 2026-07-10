import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/academic-tracks`), { headers });
    const data = await response.json().catch(() => []);
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json([], { status: 500 });
  }
}
