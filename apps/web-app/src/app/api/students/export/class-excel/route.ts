/**
 * GET /api/students/export/class-excel?academicYearId=...&classId=...
 *
 * Proxy vers le backend NestJS qui génère un fichier Excel pour UNE classe
 * officielle (AcademicClass). Une feuille par classe.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/export/class-excel`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    delete (headers as any)['Accept'];

    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur');
      console.error('[BFF class-excel] Backend error:', response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { message: errorText || 'Erreur lors de l\'export' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const disposition = response.headers.get('content-disposition') || 'attachment; filename="classe.xlsx"';
    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[BFF class-excel] Error:', error.message);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de l\'export' },
      { status: 500 }
    );
  }
}
