import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');
    const schoolLevelId = searchParams.get('schoolLevelId');
    if (!academicYearId || !schoolLevelId) {
      return NextResponse.json({ error: 'academicYearId and schoolLevelId are required' }, { status: 400 });
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/finance/fee-regimes?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId}`),
      { headers }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/finance/fee-regimes`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
