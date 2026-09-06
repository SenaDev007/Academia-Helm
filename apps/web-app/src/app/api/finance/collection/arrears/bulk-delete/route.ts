import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/collection/arrears/bulk-delete
 * ⭐ Suppression MULTIPLE d'arriérés (sous-onglet Arriérés du module Recouvrement).
 *
 * Proxy vers le backend POST /finance/collection/arrears/bulk-delete.
 * Body: { ids: string[] }
 *
 * ⚠️ MUTATION — ne jamais utiliser fetchWithTimeout ici (retry automatique
 * des timeouts = risque de double suppression). Timeout explicite long :
 * le backend traite le lot dans une transaction unique.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const r = await fetch(
      normalizeApiUrl(`${API_URL}/finance/collection/arrears/bulk-delete`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(55000),
      },
    );
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (e: any) {
    console.error('[BFF] POST arrears/bulk-delete error:', e);
    const isTimeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    return NextResponse.json(
      {
        error: isTimeout
          ? 'La suppression multiple a expiré. Vérifiez la liste des arriérés avant de réessayer (le lot est traité en une seule opération).'
          : e?.message || 'Internal server error',
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
