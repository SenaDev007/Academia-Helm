import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/cash-registers/transfer
 * Proxy BFF vers NestJS : POST /finance/cash-registers/transfer
 *
 * ⚠️ Ce fichier DOIT exister séparément, sinon la route dynamique [id]/route.ts
 * intercepte "transfer" comme un :id et renvoie 405 (POST non supporté sur [id]).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(normalizeApiUrl(`${API_URL}/finance/cash-registers/transfer`), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error transferring funds:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
