/**
 * ============================================================================
 * API PROXY — SCHOOL EMAIL : statut + configuration (même pattern que
 * settings/roles). GET /api/school-email → statut/réglages/compteur ;
 * PUT /api/school-email → enregistrement configuration SMTP.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/school-email/status`);
    const fromQuery = request.nextUrl?.searchParams?.toString();
    if (fromQuery) url.search = fromQuery;
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching school email status:', error);
    return NextResponse.json({ error: 'Failed to fetch school email status' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/school-email/config`);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    }, 60000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error saving school email config:', error);
    return NextResponse.json({ error: 'Failed to save school email config' }, { status: 500 });
  }
}
