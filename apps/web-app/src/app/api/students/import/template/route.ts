import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/students/import/template?classIds=...&academicYearId=...
 * Proxy du template Excel d'import d'élèves.
 * ⭐ 2026-11-17 — forward les query params vers le backend :
 *   - classIds (répété ou CSV) : restreint le template aux classes sélectionnées
 *     par l'utilisateur (sélecteur de classes côté modal).
 *   - academicYearId : année cible du template (cohérent avec le preview/run).
 */
export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = new URL(normalizeApiUrl(`${API_URL}/students/import/template`));
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });
    const response = await fetchWithTimeout(targetUrl.toString(), { headers, cache: 'no-store' }, 15000);
    if (!response.ok) {
      return NextResponse.json({ error: 'Erreur' }, { status: response.status });
    }
    const blob = await response.blob();
    const fileName = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'template-import-eleves.xlsx';
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
