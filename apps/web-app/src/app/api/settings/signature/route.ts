/**
 * Proxy API — Signature générée (tenant_signatures)
 * GET /api/settings/signature — récupérer directeur + URL signature
 * POST /api/settings/signature/generate — générer signature (body: directorFirstName, directorLastName)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

function buildUrl(request: NextRequest, path: string) {
  const url = new URL(`${API_BASE_URL}/settings/${path}`);
  const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
  if (tenantId) url.searchParams.set('tenant_id', tenantId);
  return url.toString();
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(buildUrl(request, 'signature'), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching signature:', error);
    return NextResponse.json({ error: 'Failed to fetch signature' }, { status: 500 });
  }
}
