import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const academicYearId = request.nextUrl.searchParams.get('academicYearId') || '';
    const url = normalizeApiUrl(
      `${API_URL}/students/${studentId}/academic-dossier${academicYearId ? `?academicYearId=${academicYearId}` : ''}`
    );
    const headers = await getProxyAuthHeaders(request);
    // ⭐ 1.0.18 — le backend renvoie désormais soit application/pdf, soit
    //    application/zip (bundle : dossier PDF + documents joints dans un seul
    //    dossier). On relaie le Content-Type tel quel — l'ancien forçage
    //    application/pdf étiquetait le ZIP « .pdf » côté client.
    // Timeout porté à 120 s : le bundle agrège le PDF + N fichiers joints.
    const response = await fetchWithTimeout(url, { headers, cache: 'no-store' }, 120000);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(error, { status: response.status });
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/pdf';
    return new NextResponse(Buffer.from(arrayBuffer), {
      status: 200,
      headers: { 'Content-Type': contentType },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate academic dossier' }, { status: 500 });
  }
}
