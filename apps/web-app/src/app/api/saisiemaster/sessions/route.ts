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

import { NextRequest } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';
import { saisieMasterOptionsResponse, saisieMasterJsonResponse } from '../_cors';

export async function OPTIONS(request: NextRequest) {
  return saisieMasterOptionsResponse(request);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return saisieMasterJsonResponse(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        401,
        request,
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
    console.error('[saisiemaster/sessions GET] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to list sessions', message },
      500,
      request,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let authHeader = request.headers.get('authorization');

    // ⭐ FIX: sendBeacon() ne peut pas définir de headers custom.
    //    Pour permettre la sauvegarde en beforeunload (sync mobile/desktop),
    //    on accepte aussi le token dans le body sous la clé `_beaconToken`.
    //    Le frontend l'envoie uniquement quand sendBeacon est utilisé.
    const body = await request.json().catch(() => null);
    if (!body) {
      return saisieMasterJsonResponse(
        { error: 'Invalid JSON body' },
        400,
        request,
      );
    }

    if (!authHeader && body._beaconToken) {
      authHeader = `Bearer ${body._beaconToken}`;
      delete body._beaconToken; // ne pas forward ce champ au backend
    }
    // Aussi supprimer le flag _beacon (marqueur sendBeacon pur)
    if (body._beacon !== undefined) delete body._beacon;

    if (!authHeader) {
      return saisieMasterJsonResponse(
        { error: 'Non authentifié — token SaisieMaster manquant' },
        401,
        request,
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
    console.error('[saisiemaster/sessions POST] error:', error);
    return saisieMasterJsonResponse(
      { error: 'Failed to save session', message },
      500,
      request,
    );
  }
}
