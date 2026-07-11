import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * ⭐ GET /api/academic-classes
 * Proxy vers GET /pedagogy/academic-structure/classes du backend.
 * Retourne la liste des classes OFFICIELLES (AcademicClass) — distinctes des
 * classes PHYSIQUES (Class) retournées par /api/all-classes.
 *
 * Utilisé par :
 *   - Module Admissions (sélecteur de classe souhaitée par le parent)
 *   - Module Inscriptions (sélecteur de classe officielle)
 *
 * Query params optionnels :
 *   - academicYearId : filtrer par année scolaire
 *   - levelId        : filtrer par niveau pédagogique
 *   - cycleId        : filtrer par cycle
 *   - isActive       : 'true' pour ne retourner que les classes actives
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/pedagogy/academic-structure/classes`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching academic classes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
