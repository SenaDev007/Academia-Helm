/**
 * API PROXY - Initialisation RBAC (permissions + rôles système en BDD)
 * Même pattern que l'onglet Structure (education/structure/initialize).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/rbac/ensure-initialized`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), { method: 'POST', headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error ensuring RBAC initialized:', error);
    return NextResponse.json({ error: 'Failed to initialize RBAC' }, { status: 500 });
  }
}
