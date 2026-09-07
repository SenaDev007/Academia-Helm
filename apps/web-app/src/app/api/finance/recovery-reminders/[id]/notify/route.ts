import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const r = await fetchWithTimeout(
    normalizeApiUrl(`${API_URL}/finance/recovery-reminders/${encodeURIComponent(id)}/notify`),
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  , 30000);
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
