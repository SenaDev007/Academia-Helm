import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/collection/arrears/:id/payment
 * Encaissement DIRECT d'un arriéré depuis l'onglet Recouvrement.
 * Backend : collection-prisma.controller.ts @Post('arrears/:id/payment')
 * → finance-transaction.service.ts createArrearPayment (trigger DB
 * update_balance_after_transaction → recalcul automatique du compte élève).
 *
 * Body: { amount, paymentMethod?, reference?, cashRegisterId?, notes? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/collection/arrears/${encodeURIComponent(id)}/payment`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      60000,
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
