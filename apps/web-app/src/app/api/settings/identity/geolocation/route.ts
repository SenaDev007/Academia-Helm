/**
 * ============================================================================
 * BFF PROXY — /api/settings/identity/geolocation
 * ============================================================================
 *
 * Proxy vers le backend NestJS : GET + PUT /settings/identity/geolocation
 * Gère les coordonnées GPS de l'école (pour le pointage des enseignants).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/identity/geolocation`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);

    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({
      configured: false,
      message: 'Coordonnées GPS non configurées.',
    }));

    return NextResponse.json(data, { status: response.ok ? 200 : response.status });
  } catch (error: any) {
    console.error('Error fetching geolocation:', error.message);
    // Retourner une réponse par défaut au lieu de crasher
    return NextResponse.json({
      configured: false,
      message: 'Coordonnées GPS non configurées.',
    }, { status: 200 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    headers['Content-Type'] = 'application/json';

    const body = await request.json();
    const url = new URL(`${API_BASE_URL}/settings/identity/geolocation`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);

    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    }, 15000);

    const data = await response.json().catch(() => ({ message: 'OK' }));
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error saving geolocation:', error.message);
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde', message: error.message },
      { status: 500 }
    );
  }
}
