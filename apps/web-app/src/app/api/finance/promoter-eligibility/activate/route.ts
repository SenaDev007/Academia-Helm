/**
 * BFF route pour POST /api/finance/promoter-eligibility/activate
 * Proxy vers le backend NestJS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json();
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(`${apiBaseUrl}/finance/promoter-eligibility/activate`);

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      15000,
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF] promoter-eligibility activate error:', error);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de l activation' },
      { status: 500 },
    );
  }
}
