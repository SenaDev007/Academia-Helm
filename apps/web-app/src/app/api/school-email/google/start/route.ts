/**
 * ============================================================================
 * API PROXY — SCHOOL EMAIL : démarrage du flux Google OAuth2 (tâche 183).
 * POST /api/school-email/google/start → { authUrl, redirectUri }.
 * Le front redirige ensuite le navigateur vers authUrl (consentement Google),
 * et Google ramène l'utilisateur sur l'api-server /school-email/google/callback
 * qui le re-dirige vers /app/settings?tab=email&google=ok|erreur.
 *
 * ⭐ 2026-11-27 — frontendOrigin : l'ORIGINE RÉELLE du navigateur (ex:
 * https://ecole.academiahelm.com) est injectée dans le corps de la requête.
 * Les sessions étant host-only par sous-domaine, le callback doit ramener le
 * directeur sur CETTE origine — l'ancien retour vers le domaine nu
 * (FRONTEND_URL) le déconnectait et l'éjectait vers /login (bug promoteur).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

/** Origine publique du navigateur derrière le proxy Vercel :
 *  x-forwarded-host/proto d'abord, sinon nextUrl.origin. */
function browserOrigin(request: NextRequest): string | undefined {
  try {
    const proto =
      request.headers.get('x-forwarded-proto') ||
      new URL(request.nextUrl.origin).protocol.replace(':', '');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (!host) return undefined;
    return `${proto}://${host.split(',')[0].trim()}`;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);

    // ⭐ Origine du navigateur — le callback Google y ramènera l'utilisateur.
    const origin = browserOrigin(request);
    const payload = {
      ...(typeof body === 'object' && body ? body : {}),
      frontendOrigin: origin,
    };

    const url = new URL(`${API_BASE_URL}/school-email/google/start`);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }, 20000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error starting Google OAuth flow:', error);
    return NextResponse.json({ message: 'Impossible de démarrer la connexion Google.' }, { status: 500 });
  }
}
