/**
 * BFF route pour /finance/collection-summary
 * Proxy vers le backend NestJS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = new URL(`${apiBaseUrl}/finance/collection-summary`);
    searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const response = await fetch(normalizeApiUrl(url.toString()), {
      headers,
      cache: 'no-store',
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF collection-summary] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collection summary', message: error.message },
      { status: 500 },
    );
  }
}
