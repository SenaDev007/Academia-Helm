import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ BFF proxy — Onglet « Frais généraux » : listing par élève.
 * GET /api/finance/student-accounts/general-fees?academicYearId=&classId=&schoolLevelId=&search=&page=&limit=&feeType=
 * Proxy vers le backend GET /finance/accounts/general-fees.
 */
export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/accounts/general-fees${qs ? `?${qs}` : ''}`),
      { headers, cache: 'no-store' },
      20000,
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
