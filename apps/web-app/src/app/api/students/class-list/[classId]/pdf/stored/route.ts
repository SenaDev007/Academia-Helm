/** GET /api/students/class-list/:classId/pdf/stored — récupère le PDF stocké */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
const API_URL = getApiBaseUrlForRoutes();
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const { classId } = await params;
    const academicYearId = request.nextUrl.searchParams.get('academicYearId');
    if (!academicYearId) return NextResponse.json({ error: 'academicYearId requis' }, { status: 400 });

    const headers = await getProxyAuthHeaders(request);
    delete (headers as any)['Accept'];

    const res = await fetch(
      normalizeApiUrl(`${API_URL}/students/class-list/${encodeURIComponent(classId)}/pdf/stored?academicYearId=${encodeURIComponent(academicYearId)}`),
      { method: 'GET', headers, cache: 'no-store' },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: text || 'Not found' }, { status: res.status });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || 'application/pdf';
    const cd = res.headers.get('content-disposition') || 'inline; filename="liste_classe.pdf"';
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': ct, 'Content-Disposition': cd, 'Content-Length': String(buffer.length), 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching stored PDF:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
