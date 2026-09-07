/**
 * API PROXY - Demande d'un code OTP pour activer le mode bilingue.
 *
 * Appelle POST /settings/bilingual/request-otp sur le backend NestJS.
 * Le backend génère un code à 6 chiffres, le stocke hashé en DB, et envoie
 * un email à s.akpovitohou@gmail.com (YEHI OR Tech).
 *
 * L'école doit ensuite contacter YEHI OR Tech pour obtenir le code (après
 * paiement) et le saisir dans l'interface pour confirmer l'activation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const hasAuth = headers['Authorization'] || headers['Cookie'];
    if (!hasAuth) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/bilingual/request-otp`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers,
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error requesting bilingual OTP:', error);
    return NextResponse.json({ error: 'Failed to request OTP' }, { status: 500 });
  }
}
