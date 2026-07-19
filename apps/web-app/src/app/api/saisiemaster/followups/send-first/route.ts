/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/followups/send-first
 * ============================================================================
 *
 * Proxy to backend:
 *   POST  /api/saisiemaster/followups/send-first  — manually send first email
 *
 * Body: { email: string }
 * Response: { sent: boolean, prospect: {...}, alreadySent: boolean }
 *
 * Public endpoint (no SaisieMaster Bearer token required) — but rate-limited
 * by the backend. Used for testing the email sequence manually.
 * ============================================================================
 */

import { NextRequest } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';
import { saisieMasterOptionsResponse, saisieMasterJsonResponse } from '../../../_cors';

export async function OPTIONS(request: NextRequest) {
  return saisieMasterOptionsResponse(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return saisieMasterJsonResponse(
        { error: 'Invalid JSON body' },
        400,
        request,
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/followups/send-first`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // email send can be slow
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
    return saisieMasterJsonResponse(data, response.status, request);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[saisiemaster/followups/send-first POST] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to trigger first follow-up email', message },
      500,
      request,
    );
  }
}
