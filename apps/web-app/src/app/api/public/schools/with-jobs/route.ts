/**
 * ============================================================================
 * SCHOOL LIST WITH JOBS API PROXY - ÉTABLISSEMENTS AVEC OFFRES D'EMPLOI
 * ============================================================================
 *
 * Single-query endpoint for the public careers page (/jobs).
 * Returns all active schools with their published job counts in one API call,
 * replacing the old N+1 pattern (fetch schools → fetch jobs per school).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

/** ISR: revalidate every 60 seconds — school data changes rarely. */
export const revalidate = 60;

export async function GET(_request: NextRequest) {
  try {
    const API_BASE_URL = getApiBaseUrlForRoutes();
    const apiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/public/schools/with-jobs`
      : `${API_BASE_URL}/api/public/schools/with-jobs`;

    const response = await fetch(normalizeApiUrl(apiUrl), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erreur HTTP ${response.status}: ${response.statusText}`,
      }));
      console.error('[Schools With Jobs API] Backend error:', errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Schools With Jobs API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch schools with jobs',
        message: error.message || 'Erreur lors de la récupération des établissements',
      },
      { status: 500 },
    );
  }
}
