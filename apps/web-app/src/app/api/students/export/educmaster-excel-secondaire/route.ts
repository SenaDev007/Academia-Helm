import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ 2026-10-01 — GET /api/students/export/educmaster-excel-secondaire
 *
 * Proxy vers le backend NestJS qui génère le fichier Excel Educmaster pour
 * le SECONDAIRE (format officiel MEMP : feuille "Mes élèves" / colonne
 * "Matricule EducMaster").
 *
 * Query params :
 *   - academicYearId (obligatoire) : UUID de l'année scolaire
 *   - className (optionnel, défaut "6e") : nom de la classe à exporter
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/export/educmaster-excel-secondaire`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    // ⭐ Ne pas forcer Accept: application/json pour une réponse binaire (Excel).
    delete (headers as any)['Accept'];

    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erreur');
      console.error('[BFF educmaster-excel-secondaire] Backend error:', response.status, errorText.substring(0, 200));
      return NextResponse.json(
        { message: errorText || 'Erreur lors de l\'export Educmaster Secondaire' },
        { status: response.status },
      );
    }

    const contentType = response.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const disposition = response.headers.get('content-disposition') || 'attachment; filename="export.xlsx"';
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
    console.error('[BFF educmaster-excel-secondaire] Error:', error.message);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de l\'export Educmaster Secondaire' },
      { status: 500 },
    );
  }
}
