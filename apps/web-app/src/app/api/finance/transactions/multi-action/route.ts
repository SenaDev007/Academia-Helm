import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/transactions/multi-action
 * Encaisse frais scolaires + articles boutique en une seule opération.
 * Body:
 * {
 *   academicYearId, studentAccountId, feeAmount,
 *   shopItems: [{ productId, quantity, unitPrice? }],
 *   paymentMethod, reference?, cashRegisterId?, customerName?, notes?
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/finance/transactions/multi-action`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e: any) {
    console.error('multi-action POST error:', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
