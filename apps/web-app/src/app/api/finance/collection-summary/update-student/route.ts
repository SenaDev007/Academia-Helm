/**
 * BFF route pour POST /finance/collection-summary/update-student
 * Proxy vers le backend NestJS.
 *
 * ⭐ Permet à l'administrateur de modifier directement les montants payés par
 *    un élève pour réaligner les données de l'année scolaire écoulée.
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
    const url = normalizeApiUrl(`${apiBaseUrl}/finance/collection-summary/update-student`);

    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      30000,
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF] update-student error:', error);
    return NextResponse.json(
      { message: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 },
    );
  }
}
