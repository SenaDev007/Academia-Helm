/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/sessions/[id]
 * ============================================================================
 *
 * Proxy to backend DELETE /api/saisiemaster/sessions/:id.
 * Forwards the SaisieMaster Bearer token from the client.
 * ============================================================================
 */

import { NextRequest } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';
import { saisieMasterOptionsResponse, saisieMasterJsonResponse } from '../../_cors';

export async function OPTIONS(request: NextRequest) {
  return saisieMasterOptionsResponse(request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return saisieMasterJsonResponse(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        401,
        request,
      );
    }

    const { id } = await params;
    if (!id) {
      return saisieMasterJsonResponse(
        { error: 'Session ID is required' },
        400,
        request,
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(
      `${apiBaseUrl}/saisiemaster/sessions/${encodeURIComponent(id)}`,
    );

    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
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
    console.error('[saisiemaster/sessions/[id] DELETE] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to delete session', message },
      500,
      request,
    );
  }
}
