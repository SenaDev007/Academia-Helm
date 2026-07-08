import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/exports/compta/csv
 * Proxy vers le backend NestJS pour générer un CSV universel mappable.
 */
export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/finance/exports/compta/csv${qs ? `?${qs}` : ''}`), { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData?.message || 'Erreur lors de la génération du CSV' },
        { status: response.status },
      );
    }

    const blob = await response.blob();
    const fileName = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'export-compta-universel.csv';
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    console.error('Erreur export CSV:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
