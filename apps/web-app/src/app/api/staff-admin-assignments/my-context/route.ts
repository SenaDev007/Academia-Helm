import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const headers = await getProxyAuthHeaders(request);
  const apiBaseUrl = getApiBaseUrlForRoutes();
  const res = await fetchWithTimeout(
    normalizeApiUrl(`${apiBaseUrl}/staff-admin-assignments/my-context`),
    { headers, cache: 'no-store' },
    15000,
  );
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
