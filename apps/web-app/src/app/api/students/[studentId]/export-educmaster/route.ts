import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/${studentId}/export-educmaster`),
      { method: 'POST', headers }
    , 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
