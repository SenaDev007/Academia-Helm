/**
 * BFF route: GET /api/billing/bilingual-status/:tenantId
 * Proxy vers le backend pour récupérer le statut de l'option bilingue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  try {
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(`${apiBaseUrl}/billing/bilingual-status/${params.tenantId}`);
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch bilingual status', message: error.message },
      { status: 500 },
    );
  }
}
