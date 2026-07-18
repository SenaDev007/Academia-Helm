/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/login
 * ============================================================================
 *
 * Proxy to the backend POST /api/saisiemaster/login endpoint.
 * Forwards email + password (when provided) for password-based auth.
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
    const body = await request.json().catch(() => null);
    if (!body || !body.email) {
      return saisieMasterJsonResponse(
        { error: 'Email est requis' },
        400,
        request,
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/login`);

    // Forward email + password (if provided) to the backend.
    const payload: Record<string, string> = { email: body.email };
    if (typeof body.password === 'string' && body.password.length > 0) {
      payload.password = body.password;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
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
    console.error('[saisiemaster/login] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to log in', message },
      500,
      request,
    );
  }
}
