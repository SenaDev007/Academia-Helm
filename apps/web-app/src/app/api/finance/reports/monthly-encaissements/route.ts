import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/reports/monthly-encaissements
 * Évolution mensuelle des encaissements (graphique du Bilan périodique et
 * du dashboard pilotage).
 * Backend : finance-reports.controller.ts:90 @Get('monthly-encaissements').
 * Avant ce fichier, la route BFF n'existait pas → 404 avalé par
 * `.catch(() => [])` dans FinanceReportsContent / FinanceDashboard →
 * graphique mensuel toujours vide.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/reports/monthly-encaissements${q ? `?${q}` : ''}`), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
