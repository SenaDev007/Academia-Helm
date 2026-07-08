import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * DELETE /api/finance/collection/arrears/[id]
 * Supprime un arriéré (pour correction d'erreurs de saisie).
 * Ajuste le StudentAccount si nécessaire (côté backend).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(
      normalizeApiUrl(`${API_URL}/finance/collection/arrears/${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        headers,
      },
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    console.error('[BFF] DELETE arrears/[id] error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
