/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/login
 * ============================================================================
 *
 * Proxy to the backend POST /api/saisiemaster/login endpoint.
 * Frictionless: just the email (no password).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.email) {
      return NextResponse.json(
        { error: 'Email est requis' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/login`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email }),
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
    console.error('[saisiemaster/login] error:', error);
    return NextResponse.json(
      { error: 'Failed to log in', message },
      { status: 500 },
    );
  }
}
