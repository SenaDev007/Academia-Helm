/**
 * ============================================================================
 * API ROUTE — Toutes les classes du tenant (sans filtrage schoolLevelId)
 * ============================================================================
 *
 * Route BFF dédiée pour récupérer TOUTES les classes du tenant courant,
 * sans filtrage par schoolLevelId du contexte admin.
 *
 * Pourquoi cette route existe :
 *   - /api/classes utilise @Query() pagination: PaginationDto avec
 *     forbidNonWhitelisted: true → le param schoolLevelId=ALL est rejeté (400)
 *   - On ne peut pas modifier le PaginationDto globalement
 *   - Cette route contourne le problème en appelant directement le backend
 *     avec le header x-school-level-id=ALL
 *
 * Utilisé par :
 *   - AdmissionsContent.tsx (affichage getClassLabel)
 *   - AdmissionForm.tsx (select de classe en édition)
 *
 * GET /api/all-classes
 *   → Response: [{ id, name, code, schoolLevelId, schoolLevel: {id, name, code} }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/classes`);
    url.searchParams.append('limit', '100');

    const headers = await getProxyAuthHeaders(request);
    headers['x-school-level-id'] = 'ALL';

    // ⚠️ Pattern standardisé : fetchWithTimeout (15s) + cache: 'no-store' + Cache-Control HTTP
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[BFF all-classes] Backend returned', response.status, JSON.stringify(data));
      return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-cache' } });
    }

    const classes = Array.isArray(data) ? data : (data?.data || data?.items || []);

    // Cache 60s (les classes changent rarement) + stale-while-revalidate 5min
    return NextResponse.json(classes, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching all-classes:', error);
    return NextResponse.json([], { status: 200, headers: { 'Cache-Control': 'no-cache' } });
  }
}
