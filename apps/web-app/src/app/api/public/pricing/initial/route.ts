/**
 * ============================================================================
 * PUBLIC PRICING INITIAL API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /public/pricing/initial
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';

export async function GET(_request: NextRequest) {
  try {
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const initialUrl = `${apiBaseUrl}/public/pricing/initial`;

    const response = await fetchWithTimeout(initialUrl, {
      method: 'GET',
      headers: bffHeaders(),
      signal: AbortSignal.timeout(8000), // 8 secondes
    cache: 'no-store',
  }, 15000);

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Pricing initial API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get initial payment price',
        message: error.message || 'Erreur lors de la récupération du prix initial'
      },
      { status: 500 }
    );
  }
}
