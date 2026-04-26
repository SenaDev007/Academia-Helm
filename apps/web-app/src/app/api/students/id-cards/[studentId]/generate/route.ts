import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const academicYearId = request.nextUrl.searchParams.get('academicYearId');
    const schoolLevelId = request.nextUrl.searchParams.get('schoolLevelId');
    if (!academicYearId || !schoolLevelId) {
      return NextResponse.json(
        { error: 'academicYearId and schoolLevelId are required' },
        { status: 400 }
      );
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/id-cards/${studentId}/generate?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId}`),
      { method: 'POST', headers }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error generating ID card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
