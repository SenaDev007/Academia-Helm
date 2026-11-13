/**
 * ============================================================================
 * API PROXY - IDENTITÉ DU NIVEAU SECONDAIRE (écoles combinées)
 * ============================================================================
 * Même pattern que identity : getProxyAuthHeaders + tenant_id en query.
 * GET    → { configured: boolean, profile | null, message? }
 * PUT    → upsert de l'override secondaire (body strict : clés du DTO backend)
 * DELETE → retour à l'identité unique (body JSON { reason? }).
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/identity/secondary`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => (null));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching secondary identity profile:', error);
    return NextResponse.json({ error: 'Failed to fetch secondary identity profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/identity/secondary`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error saving secondary identity:', error);
    return NextResponse.json({ error: 'Failed to save secondary identity' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/identity/secondary`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'DELETE',
      headers,
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error deleting secondary identity:', error);
    return NextResponse.json({ error: 'Failed to delete secondary identity' }, { status: 500 });
  }
}
