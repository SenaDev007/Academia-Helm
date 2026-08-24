/**
 * ============================================================================
 * API ROUTE: RECETTE DU JOUR
 * ============================================================================
 *
 * GET /api/finance/payments/today
 *
 * Proxie vers le backend NestJS : GET /finance/reports/today
 * Renvoie { total, count, expenses, net, date }
 *
 * Fallback : { total: 0, count: 0 } si le backend échoue.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const apiBaseUrl = getApiBaseUrlForRoutes();
    // ⭐ Proxie vers /finance/reports/today (nouveau endpoint backend)
    const url = `${apiBaseUrl}/finance/reports/today`;
    const headers = await getProxyAuthHeaders(request);

    const response = await fetchWithTimeout(
      normalizeApiUrl(url),
      { headers, cache: 'no-store' },
      10000
    );

    if (response.ok) {
      const data = await response.json().catch(() => ({ total: 0, count: 0 }));
      const total = typeof data === 'number'
        ? data
        : (data?.total ?? data?.amount ?? data?.totalAmount ?? 0);
      const count = data?.count ?? data?.paymentCount ?? 0;
      return NextResponse.json({ total, count, expenses: data?.expenses ?? 0, net: data?.net ?? total });
    }

    // Fallback : si le backend n'a pas cet endpoint, retourner 0
    return NextResponse.json({ total: 0, count: 0 });
  } catch (error) {
    console.error('Error fetching today revenue:', error);
    return NextResponse.json({ total: 0, count: 0 });
  }
}
