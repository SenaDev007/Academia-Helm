/**
 * ============================================================================
 * MAP STATS API PROXY - STATISTIQUES CARTE DU BÉNIN
 * ============================================================================
 *
 * Proxy BFF vers le backend NestJS : GET /api/public/schools/map-stats
 * Retourne les statistiques temps réel des écoles Academia Helm par département.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';

export async function GET(_request: NextRequest) {
  try {
    const API_BASE_URL = getApiBaseUrlForRoutes();
    const apiUrl = `${API_BASE_URL}/public/schools/map-stats`;

    console.log('[Map Stats API] Calling backend at:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: bffHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erreur HTTP ${response.status}: ${response.statusText}`,
      }));
      console.error('[Map Stats API] Backend error:', errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Map Stats API] Error:', error);
    return NextResponse.json(
      {
        departments: [],
        totalSchools: 0,
        totalPublic: 0,
        totalPrivate: 0,
      },
      { status: 200 }, // Return empty data rather than error to not break the map
    );
  }
}
