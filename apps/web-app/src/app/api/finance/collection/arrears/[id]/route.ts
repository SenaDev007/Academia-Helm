import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

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
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/collection/arrears/${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        headers,
      },
    30000);
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

/**
 * PATCH /api/finance/collection/arrears/[id]
 * Modifie un arriéré (correction d'erreur de saisie) : totalDue / totalPaid /
 * notes. Le backend recalcule balanceDue, statut et niveau de gravité, puis
 * resynchronise les miroirs d'arriérés du compte élève (arrearsAmount /
 * carriedArrears) — le compte élève et les KPIs sont mis à jour dynamiquement.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/collection/arrears/${encodeURIComponent(id)}`),
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      },
    30000);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    console.error('[BFF] PATCH arrears/[id] error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
