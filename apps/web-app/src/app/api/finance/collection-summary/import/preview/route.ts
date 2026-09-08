/**
 * BFF route : POST /api/finance/collection-summary/import/preview
 * Proxy vers le backend NestJS pour valider le fichier Excel du bilan.
 *
 * ⭐ Timeout 120 s : la validation d'un fichier multi-feuilles (300+ élèves,
 *    matching flou) peut prendre du temps — 30 s coupait prématurément.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/collection-summary/import/preview`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    120000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur lors de la validation du fichier. Réessayez.' }, { status: 500 });
  }
}
