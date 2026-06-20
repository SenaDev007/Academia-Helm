/**
 * BFF route: POST /api/billing/bilingual/deactivate/:tenantId
 * Proxy vers le backend pour désactiver l'option bilingue.
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
    const url = normalizeApiUrl(`${apiBaseUrl}/billing/bilingual/deactivate/${params.tenantId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to deactivate bilingual', message: error.message },
      { status: 500 },
    );
  }
}
