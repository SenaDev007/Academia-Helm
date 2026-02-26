/**
 * API PROXY - Désactiver tous les modules (settings features)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const hasAuth = headers['Authorization'] || headers['Cookie'];
    if (!hasAuth) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${getApiBaseUrlForRoutes()}/settings/features/disable-all`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const body = await request.json().catch(() => ({}));
    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error disabling all features:', error);
    return NextResponse.json({ error: 'Échec de la désactivation globale' }, { status: 500 });
  }
}
