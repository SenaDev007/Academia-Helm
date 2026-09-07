import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/settings/run-auto-recovery`), {
      method: 'POST',
      headers,
    }, 30000);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
