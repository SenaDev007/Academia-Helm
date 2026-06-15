/**
 * ============================================================================
 * API PROXY - IDENTITÉ ÉTABLISSEMENT
 * ============================================================================
 * Même pattern que bilingual et education/structure : getProxyAuthHeaders + tenant_id en query.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/identity`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => (null));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching identity profile:', error);
    return NextResponse.json({ error: 'Failed to fetch identity profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/identity`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating identity version:', error);
    return NextResponse.json({ error: 'Failed to create identity version' }, { status: 500 });
  }
}
