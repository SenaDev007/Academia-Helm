/**
 * API PROXY - Statut d'expiration du mode bilingue + statut OTP.
 *
 * Appelle GET /settings/bilingual/expiry-status sur le backend NestJS.
 * Le backend vérifie l'expiration (et désactive automatiquement si expiré)
 * puis renvoie le statut complet.
 *
 * Utilisé par le frontend pour :
 * - Afficher le compteur de jours restants avant expiration
 * - Afficher l'état de la demande OTP en cours
 * - Désactiver l'UI bilingue si expiré
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const hasAuth = headers['Authorization'] || headers['Cookie'];
    if (!hasAuth) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/bilingual/expiry-status`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching bilingual expiry status:', error);
    return NextResponse.json({ error: 'Failed to fetch expiry status' }, { status: 500 });
  }
}
