/**
 * Proxy API — Generate a nominative stamp (with holder name + role)
 * POST /api/settings/stamps/generate-nominative
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/stamps/generate-nominative`);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    if (tenantId) url.searchParams.set('tenant_id', tenantId);
    const body = await request.json().catch(() => ({}));
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error generating nominative stamp:', error);
    return NextResponse.json({ error: 'Failed to generate nominative stamp' }, { status: 500 });
  }
}
