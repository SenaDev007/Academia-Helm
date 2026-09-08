/**
 * BFF route : POST /api/finance/collection-summary/import/run
 * Proxy vers le backend NestJS pour importer le bilan des encaissements.
 *
 * ⭐ TIMEOUT LONG (280 s) : un import de masse (300+ élèves) prend 1-3 min côté
 *    backend. L'ancien timeout de 30 s coupait la connexion alors que l'import
 *    CONTINUAIT côté serveur → le retry automatique de fetchWithTimeout
 *    relançait l'import en entier → transactions en double (incident 08/09/2026).
 *    L'import est désormais idempotent (backend : lignes déjà importées ignorées),
 *    un retry éventuel reprend sans dupliquer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/collection-summary/import/run`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    280000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e: any) {
    const isTimeout =
      e?.name === 'TimeoutError' || e?.name === 'AbortError' ||
      String(e?.message || '').toLowerCase().includes('abort');
    if (isTimeout) {
      return NextResponse.json(
        {
          error:
            "L'importation prend plus de temps que prévu et la connexion a été coupée. " +
            "Elle se peut qu'elle se poursuive en arrière-plan : patientez 2 minutes, puis cliquez " +
            "à nouveau sur « Importer » — les lignes déjà importées seront ignorées automatiquement " +
            "(protection anti-doublon), aucune transaction ne sera dupliquée.",
        },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: 'Erreur du serveur pendant l\'importation. Réessayez — les lignes déjà importées seront ignorées (aucun doublon possible).' },
      { status: 500 },
    );
  }
}
