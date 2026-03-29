/**
 * API PROXY - ACTIVATE IDENTITY VERSION
 * Même pattern que bilingual / identity : getProxyAuthHeaders + tenant_id en query.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/identity/activate/${versionId}`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error activating identity version:', error);
    return NextResponse.json({ error: 'Failed to activate identity version' }, { status: 500 });
  }
}
