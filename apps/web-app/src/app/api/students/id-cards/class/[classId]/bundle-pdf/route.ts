import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get('academicYearId');
    if (!academicYearId) {
      return NextResponse.json({ error: 'academicYearId is required' }, { status: 400 });
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/id-cards/class/${classId}/bundle-pdf?academicYearId=${encodeURIComponent(academicYearId)}`),
      { headers }
    , 15000);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    }
    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': response.headers.get('content-disposition') || `attachment; filename="cartes-classe-${classId}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
