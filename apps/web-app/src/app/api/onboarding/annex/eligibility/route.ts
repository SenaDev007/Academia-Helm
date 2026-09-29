/**
 * ============================================================================
 * ONBOARDING ANNEX ELIGIBILITY API ROUTE — Multi-écoles (paramètres promoteur)
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend GET /onboarding/annex/eligibility.
 * Éligibilité multi-écoles du promoteur courant : écoles déjà gérées
 * (UserTenant ∪ tenant direct) + prix de la prochaine annexe (par école).
 * Relais Authorization strict.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

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
    const url = new URL(`${apiBase}/onboarding/annex/eligibility`);

    const response = await fetch(normalizeApiUrl(url.toString()), {
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
    console.error('Error in annex eligibility:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    );
  }
}
