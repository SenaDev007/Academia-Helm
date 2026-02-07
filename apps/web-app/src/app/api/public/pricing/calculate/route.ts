/**
 * ============================================================================
 * PUBLIC PRICING CALCULATE API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /public/pricing/calculate
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const calculateUrl = `${apiBaseUrl}/public/pricing/calculate`;

    const response = await fetch(calculateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // 30 secondes
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Pricing calculate API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate price',
        message: error.message || 'Erreur lors du calcul du prix'
      },
      { status: 500 }
    );
  }
}
