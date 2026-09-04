/**
 * ============================================================================
 * ANALYTICS CONSOLIDATED API ROUTE — Vue stratégique du groupe (promoteur)
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend GET /analytics/consolidated.
 * KPIs consolidés multi-écoles : périmètre résolu côté NestJS depuis
 * l'identité JWT (UserTenant ∪ tenant direct — jamais depuis un paramètre
 * client). Relais Authorization strict.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 },
      );
    }

    const apiBase = getApiBaseUrlForRoutes();
    const url = new URL(`${apiBase}/analytics/consolidated`);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in analytics consolidated:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    );
  }
}
