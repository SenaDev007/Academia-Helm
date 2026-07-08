import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * DELETE /api/finance/recovery-reminders/[id]
 * Supprime une relance (pour correction d'erreurs de saisie).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(
      normalizeApiUrl(`${API_URL}/finance/recovery-reminders/${encodeURIComponent(id)}`),
      {
        method: 'DELETE',
        headers,
      },
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    console.error('[BFF] DELETE recovery-reminders/[id] error:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
