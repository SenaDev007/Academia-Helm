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
    const academicYearId = request.nextUrl.searchParams.get('academicYearId') || '';
    const url = normalizeApiUrl(
      `${API_URL}/api/students/${studentId}/academic-dossier${academicYearId ? `?academicYearId=${academicYearId}` : ''}`
    );
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(error, { status: response.status });
    }
    const arrayBuffer = await response.arrayBuffer();
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate academic dossier' }, { status: 500 });
  }
}
