/**
 * ============================================================================
 * BFF ROUTE — /api/saisiemaster/testimonials
 * ============================================================================
 *
 * Proxy to backend:
 *   GET   /api/saisiemaster/testimonials  — list published testimonials (public)
 *   POST  /api/saisiemaster/testimonials  — submit a new testimonial (auth)
 *
 * Forwards the SaisieMaster Bearer token from the client (POST only).
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

export async function GET(request: NextRequest) {
  try {
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/testimonials`);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
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
    console.error('[saisiemaster/testimonials GET] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to list testimonials', message },
      500,
      request,
    );
  }
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
    if (!body) {
      return saisieMasterJsonResponse(
        { error: 'Invalid JSON body' },
        400,
        request,
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = normalizeApiUrl(`${apiBaseUrl}/saisiemaster/testimonials`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
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
    return saisieMasterJsonResponse(data, response.status, request);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[saisiemaster/testimonials POST] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to submit testimonial', message },
      500,
      request,
    );
  }
}
