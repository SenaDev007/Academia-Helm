import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const academicYearId = request.nextUrl.searchParams.get('academicYearId');
    if (!academicYearId) {
      return NextResponse.json({ error: 'academicYearId is required' }, { status: 400 });
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/finance/student-fee-profiles/student/${studentId}?academicYearId=${academicYearId}`),
      { headers }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
