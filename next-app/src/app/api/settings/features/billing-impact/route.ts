/**
 * ============================================================================
 * API PROXY - SETTINGS FEATURES BILLING IMPACT
 * Auth + tenant_id (même pattern que bilingual).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${getApiBaseUrlForRoutes()}/settings/features/billing-impact`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching billing impact:', error);
    return NextResponse.json({ error: 'Failed to fetch billing impact' }, { status: 500 });
  }
}

