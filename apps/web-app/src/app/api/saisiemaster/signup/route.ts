import { NextRequest } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';
import { getSaisieMasterCorsHeaders, saisieMasterOptionsResponse, saisieMasterJsonResponse } from '../_cors';

export async function OPTIONS(request: NextRequest) {
  return saisieMasterOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return saisieMasterJsonResponse({ error: 'Invalid JSON body' }, 400, request);
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/signup`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000), // ⭐ 60s pour couvrir les cold starts Vercel
    });

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        return saisieMasterJsonResponse({ error: 'Réponse invalide du serveur API', raw }, 502, request);
      }
    }

    if (!response.ok) {
      return saisieMasterJsonResponse(data, response.status, request);
    }
    return saisieMasterJsonResponse(data, 200, request);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[saisiemaster/signup] error:', error);
    return saisieMasterJsonResponse({ error: 'Failed to sign up prospect', message }, 500, request);
  }
}
