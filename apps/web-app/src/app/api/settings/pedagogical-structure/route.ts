/**
 * ============================================================================
 * API PROXY - SETTINGS PEDAGOGICAL STRUCTURE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    const url = new URL(nestControllerUrl('settings/pedagogical-structure'));
    if (tenantId) url.searchParams.set('tenant_id', tenantId);
    const response = await fetchWithTimeout(url.toString(), { headers, cache: 'no-store' }, 15000);

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching pedagogical structure:', error);
    return NextResponse.json({ error: 'Failed to fetch pedagogical structure' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    const url = new URL(nestControllerUrl('settings/pedagogical-structure'));
    if (tenantId) url.searchParams.set('tenant_id', tenantId);
    const response = await fetchWithTimeout(url.toString(), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    }, 30000);

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error updating pedagogical structure:', error);
    return NextResponse.json({ error: 'Failed to update pedagogical structure' }, { status: 500 });
  }
}
