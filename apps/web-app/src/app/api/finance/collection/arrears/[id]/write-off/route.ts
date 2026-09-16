import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/collection/arrears/:id/write-off
 * Abandonne une créance (write-off) avec motif.
 * Backend : collection-prisma.controller.ts @Post('arrears/:id/write-off')
 * → arrear-accumulation.service.ts:294.
 * Avant ce fichier, le bouton « Abandonner la créance » (RecoveryContent)
 * recevait un 404 — la route BFF n'existait pas alors que le service
 * frontend (finance.service.ts:497 writeOffArrear) l'appelait.
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
      normalizeApiUrl(`${API_URL}/finance/collection/arrears/${encodeURIComponent(id)}/write-off`),
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
