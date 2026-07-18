/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/sessions
 * ============================================================================
 *
 * Proxy to backend:
 *   GET    /api/saisiemaster/sessions  — list prospect's sessions
 *   POST   /api/saisiemaster/sessions  — save (upsert) a session
 *
 * Forwards the SaisieMaster Bearer token from the client.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        { status: 401 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/sessions`);

    const response = await fetch(targetUrl, {
      method: 'GET',
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
    console.error('[saisiemaster/sessions GET] error:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions', message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/sessions`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000), // grade data can be large
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
    console.error('[saisiemaster/sessions POST] error:', error);
    return NextResponse.json(
      { error: 'Failed to save session', message },
      { status: 500 },
    );
  }
}
