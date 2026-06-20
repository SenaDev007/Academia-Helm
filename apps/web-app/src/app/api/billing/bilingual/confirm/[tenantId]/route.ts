/**
 * BFF route: POST /api/billing/bilingual/confirm/:tenantId
 * Proxy vers le backend pour confirmer l'activation bilingue après paiement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  try {
    const body = await request.json();
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(`${apiBaseUrl}/billing/bilingual/confirm/${params.tenantId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to confirm bilingual', message: error.message },
      { status: 500 },
    );
  }
}
