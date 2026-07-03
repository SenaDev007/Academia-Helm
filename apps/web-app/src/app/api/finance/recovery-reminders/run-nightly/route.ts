import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export async function POST(request: NextRequest) {
  const headers = await getProxyAuthHeaders(request);
  const r = await fetch(normalizeApiUrl(`${API_URL}/finance/recovery-reminders/run-nightly`), { method: 'POST', headers });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
