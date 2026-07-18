/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/sessions/[id]
 * ============================================================================
 *
 * Proxy to backend DELETE /api/saisiemaster/sessions/:id.
 * Forwards the SaisieMaster Bearer token from the client.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        { status: 401 },
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 },
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
        return NextResponse.json(
          { error: 'Réponse invalide du serveur API', raw },
          { status: 502 },
        );
      }
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[saisiemaster/sessions/[id] DELETE] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session', message },
      { status: 500 },
    );
  }
}
