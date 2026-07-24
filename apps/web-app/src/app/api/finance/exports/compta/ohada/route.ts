import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/exports/compta/ohada
 * Proxy vers le backend NestJS pour générer un CSV OHADA (Bénin/Afrique).
 */
export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/exports/compta/ohada${qs ? `?${qs}` : ''}`), { headers , cache: 'no-store' }, 15000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData?.message || 'Erreur lors de la génération du CSV OHADA' },
        { status: response.status },
      );
    }

    const blob = await response.blob();
    const fileName = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'export-compta-ohada.csv';
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error('Erreur export OHADA:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
