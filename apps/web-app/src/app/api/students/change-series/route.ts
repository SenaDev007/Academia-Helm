import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ POST /api/students/change-series
 * Changement de série officielle d'un élève.
 * Body: { studentId, academicYearId, newSeriesId, reason? }
 *
 * Utilisé par le sous-onglet "Changement de série".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/students/change-series`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error changing series:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
