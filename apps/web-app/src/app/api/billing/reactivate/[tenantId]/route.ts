/**
 * BFF route: POST /api/billing/reactivate/:tenantId
 * Proxy vers le backend pour réactiver un abonnement BLOQUÉ (frais de
 * réactivation). ⭐ Route manquante (404) auparavant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const body = await request.json().catch(() => ({}));
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(`${apiBaseUrl}/billing/reactivate/${tenantId}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to reactivate subscription', message: error.message },
      { status: 500 },
    );
  }
}
