/**
 * BFF route pour /finance/collection-summary
 * Proxy vers le backend NestJS.
 *
 * ⭐ Utilise fetchWithTimeout (30s) au lieu de fetch natif pour éviter
 *    les "Failed to fetch" quand le backend est lent ou injoignable.
 *    Le timeout natif du navigateur est ~60-120s selon les navigateurs,
 *    ce qui est trop long pour une bonne UX.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel serverless function timeout

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = new URL(`${apiBaseUrl}/finance/collection-summary`);
    searchParams.forEach((value, key) => url.searchParams.append(key, value));

    // ⭐ fetchWithTimeout avec 30s — si le backend ne répond pas, on retourne
    //    une erreur propre au lieu de laisser le navigateur timeout.
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { headers, cache: 'no-store' },
      30000,
    );

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF collection-summary] Error:', error?.message || error);

    // ⭐ Messages d'erreur différenciés selon le type d'erreur
    const errMsg = error?.message || String(error);
    let userMessage = 'Erreur lors du chargement du bilan des encaissements';
    let statusCode = 500;

    if (error?.name === 'AbortError' || errMsg.includes('timeout') || errMsg.includes('Timeout')) {
      userMessage = 'Le backend met trop de temps à répondre (timeout 30s). Réessayez dans un instant.';
      statusCode = 504; // Gateway Timeout
    } else if (error?.code === 'ECONNREFUSED' || errMsg.includes('fetch failed') || errMsg.includes('network')) {
      userMessage = 'Le serveur backend est injoignable. Vérifiez la connexion.';
      statusCode = 502; // Bad Gateway
    }

    return NextResponse.json(
      { error: userMessage, message: errMsg, detail: 'BFF collection-summary proxy error' },
      { status: statusCode },
    );
  }
}
