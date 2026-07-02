/** GET /api/students/class-list/:classId/pdf/exists — vérifie si le PDF existe */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const { classId } = await params;
    const academicYearId = request.nextUrl.searchParams.get('academicYearId');
    if (!academicYearId) return NextResponse.json({ exists: false });

    const headers = await getProxyAuthHeaders(request);
    const res = await fetch(
      normalizeApiUrl(`${API_URL}/students/class-list/${encodeURIComponent(classId)}/pdf/exists?academicYearId=${encodeURIComponent(academicYearId)}`),
      { headers, cache: 'no-store' },
    );
    const data = await res.json().catch(() => ({ exists: false }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ exists: false });
  }
}
