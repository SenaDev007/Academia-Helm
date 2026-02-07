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
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const initialUrl = `${apiBaseUrl}/public/pricing/initial`;

    const response = await fetch(initialUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // 30 secondes
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
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
