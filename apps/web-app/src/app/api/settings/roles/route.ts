/**
 * ============================================================================
 * API PROXY - SETTINGS ROLES (même pattern que rbac/ensure-initialized et structure/initialize)
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/roles`);
    const fromQuery = request.nextUrl?.searchParams?.toString();
    if (fromQuery) url.search = fromQuery;
    const response = await fetch(normalizeApiUrl(url.toString()), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/roles`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
  }
}
