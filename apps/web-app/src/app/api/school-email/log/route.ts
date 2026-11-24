/**
 * ============================================================================
 * API PROXY — SCHOOL EMAIL LOG : GET /api/school-email/log → journal des
 * 50 derniers envois (date, module, destinataire, statut).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/school-email/log`);
    const fromQuery = request.nextUrl?.searchParams?.toString();
    if (fromQuery) url.search = fromQuery;
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching school email log:', error);
    return NextResponse.json({ error: 'Failed to fetch school email log' }, { status: 500 });
  }
}
