import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/finance/reports?academicYearId=...
 * KPI financiers consolidés PAR NIVEAU SCOLAIRE.
 *
 * Backend : finance-reports.controller.ts @Get('by-level') →
 * finance-reports.service.ts getKpiByLevel (réutilise getKpi avec un scope
 * synthétique mono-niveau).
 *
 * Avant cette route : la page « Agrégation & Bilan Global » (Finance)
 * appelait /api/finance/reports qui n'existait ni côté BFF ni côté backend
 * → fallback silencieux → 0 FCFA affiché partout.
 */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/reports/by-level${q ? `?${q}` : ''}`),
      { headers, cache: 'no-store' },
      30000,
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
