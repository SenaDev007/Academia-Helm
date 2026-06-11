/**
 * API PROXY - IDENTITY HISTORY
 * Même pattern que bilingual / identity : getProxyAuthHeaders + tenant_id en query.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const url = new URL(`${API_BASE_URL}/settings/identity/history`);
    url.searchParams.set('limit', limit);
    url.searchParams.set('offset', offset);
    const fromQuery = searchParams.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching identity history:', error);
    return NextResponse.json({ error: 'Failed to fetch identity history' }, { status: 500 });
  }
}
