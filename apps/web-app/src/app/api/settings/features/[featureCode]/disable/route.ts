/**
 * ============================================================================
 * API PROXY - SETTINGS FEATURES DISABLE
 * Auth + tenant_id (même pattern que bilingual).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureCode: string }> }
) {
  try {
    const { featureCode } = await params;
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${getApiBaseUrlForRoutes()}/settings/features/${featureCode}/disable`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const body = await request.json().catch(() => ({}));
    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error disabling feature:', error);
    return NextResponse.json({ error: 'Failed to disable feature' }, { status: 500 });
  }
}

