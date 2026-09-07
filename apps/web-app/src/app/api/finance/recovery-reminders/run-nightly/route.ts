import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
const API_URL = getApiBaseUrlForRoutes();
export async function POST(request: NextRequest) {
  const headers = await getProxyAuthHeaders(request);
  const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/recovery-reminders/run-nightly`), { method: 'POST', headers }, 30000);
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
