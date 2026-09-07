import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * DELETE /api/students/id-cards/all?academicYearId=...
 * Supprime TOUTES les cartes du tenant (optionnellement filtrées par année scolaire).
 */
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/id-cards/all`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { method: 'DELETE', headers }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting all ID cards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
