/**
 * BFF route : GET /api/finance/fee-structures/overrides/import/template
 * Proxy vers le backend NestJS pour télécharger le template Excel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_URL}/finance/fee-structures/overrides/import/template`);
    searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);
    if (!response.ok) {
      return NextResponse.json({ error: 'Erreur' }, { status: response.status });
    }
    const blob = await response.blob();
    const fileName =
      response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ||
      'template-import-personnalisations.xlsx';
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
