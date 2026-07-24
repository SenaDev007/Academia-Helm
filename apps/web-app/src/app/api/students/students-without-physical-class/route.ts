import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ GET /api/students/students-without-physical-class
 * Liste les élèves admis/inscrits SANS classe physique (classId NULL).
 * Query: ?academicYearId=...
 *
 * Utilisé par le sous-onglet "Affectation vers classe physique".
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/students-without-physical-class`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('Error fetching students without physical class:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
