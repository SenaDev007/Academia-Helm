/**
 * BFF route: GET /api/billing/subscription-status/:tenantId
 * Proxy vers le backend pour récupérer le statut d'abonnement d'une école
 * (ACTIVE / GRACE_PERIOD / SUSPENDED / BLOCKED, dates du cycle de vie).
 * ⭐ Utilisée par le bandeau SubscriptionBanner et la page Facturation —
 *    cette route manquait (404) : le mode lecture seule n'était jamais
 *    signalé côté école.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await params;
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = normalizeApiUrl(`${apiBaseUrl}/billing/subscription-status/${tenantId}`);
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch subscription status', message: error.message },
      { status: 500 },
    );
  }
}
