/**
 * Proxy API — Cachets générés (tenant_stamps)
 * GET /api/settings/stamps — récupérer les URLs des cachets
 * (Génération : POST /api/settings/stamps/generate)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

function buildUrl(request: NextRequest, path: string) {
  const url = new URL(`${API_BASE_URL}/settings/${path}`);
  const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
  const educationLevelId = request.nextUrl?.searchParams?.get('education_level_id');
  const list = request.nextUrl?.searchParams?.get('list');
  if (tenantId) url.searchParams.set('tenant_id', tenantId);
  if (educationLevelId) url.searchParams.set('education_level_id', educationLevelId);
  if (list) url.searchParams.set('list', list);
  return url.toString();
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(buildUrl(request, 'stamps'), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching stamps:', error);
    return NextResponse.json({ error: 'Failed to fetch stamps' }, { status: 500 });
  }
}
