/**
 * API PROXY - Activer tous les modules (settings features)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const hasAuth = headers['Authorization'] || headers['Cookie'];
    if (!hasAuth) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${getApiBaseUrlForRoutes()}/settings/features/enable-all`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const body = await request.json().catch(() => ({}));
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error enabling all features:', error);
    return NextResponse.json({ error: 'Échec de l\'activation globale' }, { status: 500 });
  }
}
