import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/students/import/classes?academicYearId=...
 * ⭐ 2026-11-17 — Liste des classes physiques disponibles pour le template
 * d'import (année cible si fournie, sinon année ACTIVE du backend). Nourrit
 * le sélecteur de classes du modal d'import : l'école choisit les classes
 * pour lesquelles elle veut faire l'importation de masse.
 */
export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = new URL(normalizeApiUrl(`${API_URL}/students/import/classes`));
    searchParams.forEach((value, key) => {
      targetUrl.searchParams.append(key, value);
    });
    const response = await fetchWithTimeout(targetUrl.toString(), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
