import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/students/export/educmaster-excel?academicYearId=...&schoolLevelId=...
 * Proxy vers le backend NestJS qui génère le fichier Excel EDUCMASTER.
 * Le backend retourne un StreamableFile (buffer Excel) qui est renvoyé tel quel.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/export/educmaster-excel`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur');
      console.error('[BFF educmaster-excel] Backend error:', response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { message: errorText || 'Erreur lors de l\'export EDUCMASTER' },
        { status: response.status }
      );
    }

    // Le backend retourne un fichier Excel (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
    const contentType = response.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const disposition = response.headers.get('content-disposition') || 'attachment; filename="export.xlsx"';
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
      },
    });
  } catch (error: any) {
    console.error('[BFF educmaster-excel] Error:', error.message);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de l\'export EDUCMASTER' },
      { status: 500 }
    );
  }
}
