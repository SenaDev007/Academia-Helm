import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * BFF pour la gestion des templates de design des cartes scolaires (CMS).
 * Proxy vers le backend NestJS :
 *   - GET  /students/id-cards/templates      → liste (système + custom)
 *   - POST /students/id-cards/templates      → crée un template custom
 *
 * Le backend est idempotent : listTemplates crée les 4 presets système
 * manquants à la volée (CLASSIQUE, MODERNE, MINIMALISTE, BILINGUE).
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/id-cards/templates`);
    request.nextUrl.searchParams.forEach((value, key) =>
      url.searchParams.append(key, value),
    );
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers , cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[BFF] Error fetching card templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || (!body.name && !body.key)) {
      return NextResponse.json(
        { error: 'name and key are required' },
        { status: 400 },
      );
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/students/id-cards/templates`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[BFF] Error creating card template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
