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
    const body = await request.json();
    if (!body.academicYearId) {
      return NextResponse.json({ error: 'academicYearId is required' }, { status: 400 });
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/${studentId}/verification-token/regenerate`),
      { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ academicYearId: body.academicYearId }) }
    , 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error regenerating verification token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
