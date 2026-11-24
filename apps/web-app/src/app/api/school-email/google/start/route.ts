/**
 * ============================================================================
 * API PROXY — SCHOOL EMAIL : démarrage du flux Google OAuth2 (tâche 183).
 * POST /api/school-email/google/start → { authUrl, redirectUri }.
 * Le front redirige ensuite le navigateur vers authUrl (consentement Google),
 * et Google ramène l'utilisateur sur l'api-server /school-email/google/callback
 * qui le re-dirige vers /app/settings?tab=email&google=ok|erreur.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/school-email/google/start`);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, 20000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error starting Google OAuth flow:', error);
    return NextResponse.json({ message: 'Impossible de démarrer la connexion Google.' }, { status: 500 });
  }
}
