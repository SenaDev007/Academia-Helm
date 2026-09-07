import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';


const API_URL = getApiBaseUrlForRoutes();

/**
 * BFF pour la gestion des templates de design des cartes scolaires (CMS).
 * Proxy vers le backend NestJS :
 *   - GET    /students/id-cards/templates/:keyOrId  → détail d'un template
 *   - PUT    /students/id-cards/templates/:id       → modifie un template custom
 *   - DELETE /students/id-cards/templates/:id       → archive (soft delete) un template custom
 *
 * Le backend accepte indifféremment une clé (CLASSIQUE, MODERNE, ...) ou un UUID
 * pour le GET. Les templates système ne sont pas modifiables (lecture seule).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/id-cards/templates/${encodeURIComponent(id)}`),
      { headers },
    15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('[BFF] Error fetching card template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/id-cards/templates/${encodeURIComponent(id)}`),
      {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      },
    30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('[BFF] Error updating card template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/id-cards/templates/${encodeURIComponent(id)}`),
      { method: 'DELETE', headers },
    30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('[BFF] Error deleting card template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
