/**
 * Proxy API — Liste des signatures (tenant_signatures, par niveau et rôle)
 * GET /api/settings/signatures?tenant_id=...&education_level_id=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

function buildUrl(request: NextRequest) {
  const url = new URL(`${API_BASE_URL}/settings/signatures`);
  const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
  const educationLevelId = request.nextUrl?.searchParams?.get('education_level_id');
  if (tenantId) url.searchParams.set('tenant_id', tenantId);
  if (educationLevelId) url.searchParams.set('education_level_id', educationLevelId);
  return url.toString();
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(buildUrl(request), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching signatures list:', error);
    return NextResponse.json({ error: 'Failed to fetch signatures' }, { status: 500 });
  }
}
