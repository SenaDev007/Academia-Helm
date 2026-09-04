/**
 * Proxy API — Resend a shop sale receipt via email / Helm Connect.
 * POST /api/modules-complementaires/shop/sales/:id/resend
 *
 * Body: { channels?: string[] } — default ['email', 'helm_connect']
 *
 * ⭐ Pattern identical to /api/finance/transactions/[id]/resend/route.ts
 *    but for boutique sales. The backend regenerates the PDF and queues
 *    the notification(s).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(`${API_BASE_URL}/modules-complementaires/shop/sales/${id}/resend`);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    if (tenantId) url.searchParams.set('tenant_id', tenantId);

    const headers = await getProxyAuthHeaders(request);
    const body = await request.json().catch(() => ({}));

    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error resending shop receipt:', error);
    return NextResponse.json(
      { error: 'Failed to resend shop receipt' },
      { status: 500 },
    );
  }
}
