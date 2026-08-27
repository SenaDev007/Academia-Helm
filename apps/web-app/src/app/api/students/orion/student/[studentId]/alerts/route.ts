import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ BFF proxy route for student-specific ORION alerts.
 *
 * Frontend : GET /api/students/orion/student/:studentId/alerts
 *   → proxy → Backend : GET /api/students/orion/student/:studentId/alerts
 *
 * Le backend renvoie `{ alerts: [...], student: {...} }` avec 8 catégories
 * d'alertes (MATRICULE, STATUS, IDENTITY NPI, PHOTO, GUARDIAN, CARD,
 * ENROLLMENT) + recommandations actionnables.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } },
) {
  try {
    const studentId = params.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });
    }

    const url = new URL(`${API_URL}/students/orion/student/${encodeURIComponent(studentId)}/alerts`);
    // Forward query params (academicYearId, etc.)
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { headers, cache: 'no-store' },
      15000,
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching student ORION alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
