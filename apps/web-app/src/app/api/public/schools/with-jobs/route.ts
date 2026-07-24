/**
 * ============================================================================
 * SCHOOL LIST WITH JOBS API PROXY - ÉTABLISSEMENTS AVEC OFFRES D'EMPLOI
 * ============================================================================
 *
 * Single-query endpoint for the public careers page (/jobs).
 * Returns all active schools with their published job counts in one API call,
 * replacing the old N+1 pattern (fetch schools → fetch jobs per school).
 *
 * ⚠️ Pattern standardisé : utilise bffFetchJson() + buildCacheHeaders()
 * Voir docs/CACHE_PERFORMANCE_PATTERN.md
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { bffFetchJson, buildCacheHeaders, gracefulTimeoutResponse } from '@/lib/api/bff-fetch';

/** Force dynamic — ne pas pré-render au build (backend peut être lent). */
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const data = await bffFetchJson<any[]>('/public/schools/with-jobs');
    return NextResponse.json(data, {
      headers: buildCacheHeaders(data, { minItems: 1 }),
    });
  } catch (error: any) {
    console.error('[Schools With Jobs API] Error:', error.message);

    // Timeout → réponse gracieuse (liste vide au lieu de 504)
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        gracefulTimeoutResponse('établissements'),
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch schools with jobs',
        message: error.message || 'Erreur lors de la récupération des établissements',
      },
      { status: 500 },
    );
  }
}
