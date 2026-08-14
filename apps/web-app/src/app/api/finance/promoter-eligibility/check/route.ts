/**
 * BFF route pour GET /api/finance/promoter-eligibility/check
 * Proxy vers le backend NestJS.
 *
 * Vérifie si un élève est marqué "paiement fondateur" (pour le toggle).
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = new URL(`${apiBaseUrl}/finance/promoter-eligibility/check`);
    searchParams.forEach((value, key) => url.searchParams.append(key, value));

    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { headers, cache: 'no-store' },
      15000,
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF] promoter-eligibility check error:', error);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de la vérification' },
      { status: 500 },
    );
  }
}
