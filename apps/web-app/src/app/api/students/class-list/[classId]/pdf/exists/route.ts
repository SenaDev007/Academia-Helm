/** GET /api/students/class-list/:classId/pdf/exists — vérifie si le PDF existe */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
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

    // ⭐ Forward le paramètre mode (official | physical) au backend.
    // Sans cela, le backend default à 'physical' et ne trouve pas un PDF généré en mode 'official'.
    const mode = request.nextUrl.searchParams.get('mode') || 'physical';

    const headers = await getProxyAuthHeaders(request);
    const res = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/class-list/${encodeURIComponent(classId)}/pdf/exists?academicYearId=${encodeURIComponent(academicYearId)}&mode=${encodeURIComponent(mode)}`),
      { headers, cache: 'no-store' },
    15000);
    const data = await res.json().catch(() => ({ exists: false }));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json({ exists: false });
  }
}
