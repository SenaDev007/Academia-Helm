import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ POST /api/students/assign-physical-class
 * Affectation initiale d'un élève vers une classe PHYSIQUE.
 * Body: { studentId, academicYearId, physicalClassId, reason? }
 *
 * Utilisé par le sous-onglet "Affectation vers classe physique".
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/students/assign-physical-class`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error assigning physical class:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
