/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/track
 * ============================================================================
 *
 * Proxy to backend POST /api/saisiemaster/track.
 * Tracks prospect activity for lead scoring.
 * Forwards the SaisieMaster Bearer token from the client.
 * ============================================================================
 */

import { NextRequest } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';
import { saisieMasterOptionsResponse, saisieMasterJsonResponse } from '../_cors';

export async function OPTIONS(request: NextRequest) {
  return saisieMasterOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return saisieMasterJsonResponse(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        401,
        request,
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.type) {
      return saisieMasterJsonResponse(
        { error: 'type is required (login | grade_entered | export)' },
        400,
        request,
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/track`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        return saisieMasterJsonResponse(
          { error: 'Réponse invalide du serveur API', raw },
          502,
          request,
        );
      }
    }

    if (!response.ok) {
      return saisieMasterJsonResponse(data, response.status, request);
    }
    return saisieMasterJsonResponse(data, 200, request);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[saisiemaster/track] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to track activity', message },
      500,
      request,
    );
  }
}
