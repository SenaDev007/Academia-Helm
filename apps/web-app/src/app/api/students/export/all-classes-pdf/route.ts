/**
 * GET /api/students/export/all-classes-pdf?academicYearId=...&code=...
 *
 * Proxy vers le backend NestJS qui génère un PDF de TOUTES les classes
 * d'un niveau, regroupées par niveau.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/export/all-classes-pdf`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    delete (headers as any)['Accept'];

    const response = await fetch(normalizeApiUrl(url.toString()), { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur');
      console.error('[BFF all-classes-pdf] Backend error:', response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { message: errorText || 'Erreur lors de l\'export' },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/pdf';
    const disposition = response.headers.get('content-disposition') || 'attachment; filename="listes_classes.pdf"';
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
    console.error('[BFF all-classes-pdf] Error:', error.message);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de l\'export' },
      { status: 500 }
    );
  }
}
