import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ BFF route pour GET /students/id-cards/preview-card
 * Retourne { cardId: string | null } — l'ID de la carte la plus récente,
 * pour l'aperçu PDF du studio de design. Léger vs `grouped-by-class`.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/id-cards/preview-card`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({ cardId: null }));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('Error fetching preview card id:', error);
    return NextResponse.json({ cardId: null, error: 'Internal server error' }, { status: 500 });
  }
}
