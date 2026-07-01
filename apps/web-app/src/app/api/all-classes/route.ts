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

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/classes`);
    // On utilise limit=100 (max accepté par PaginationDto) et on force schoolLevelId=ALL
    url.searchParams.append('limit', '100');
    url.searchParams.append('schoolLevelId', 'ALL');

    const headers = await getProxyAuthHeaders(request);
    // ⚠️ Forcer le header x-school-level-id=ALL pour que le SchoolLevelId decorator
    // (priorité 1 = header) retourne ALL au lieu du schoolLevelId du contexte admin.
    headers['x-school-level-id'] = 'ALL';

    const response = await fetch(normalizeApiUrl(url.toString()), { headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('[BFF all-classes] Backend returned', response.status, JSON.stringify(data));
      return NextResponse.json([], { status: 200 }); // fallback vide plutôt qu'erreur
    }

    // La réponse peut être un tableau ou un objet paginé { data: [...], total, ... }
    const classes = Array.isArray(data) ? data : (data?.data || data?.items || []);
    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching all-classes:', error);
    return NextResponse.json([], { status: 200 }); // fallback vide
  }
}
