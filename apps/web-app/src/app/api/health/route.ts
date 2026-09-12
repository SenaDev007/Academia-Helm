/**
 * Health Check API Route
 *
 * Vérifie que le backend NestJS (Railway) répond.
 * Utilisé par :
 *   - Les moniteurs de disponibilité externes (uptime) via GET
 *   - Les health checks de plateforme (liveness) via HEAD
 *
 * ⭐ CORRECTIF (sept. 2026) : le health check du backend est servi À LA RACINE
 *   (`/health`), volontairement EXCLU du préfixe global `api` (cf. main.ts :
 *   `setGlobalPrefix('api', { exclude: ['health'] })` — pattern Railway/load
 *   balancer). L'ancien code appelait `${API_URL}/health` où API_URL se
 *   termine par `/api` → requête vers `/api/health` → 404 NestJS systématique
 *   → la route renvoyait un 503 « Backend indisponible » ALORS QUE le backend
 *   était sain (faux statut « down » pour tout monitoring externe).
 */

import { NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/** Origine du backend = base API sans le suffixe `/api` (ex. https://api.academiahelm.com). */
function backendOrigin(): string {
  return normalizeApiUrl(API_URL.replace(/\/api\/?$/, ''));
}

export async function GET() {
  try {
    // Vérifier que le backend répond — health check à la RACINE du backend
    const headers = await getProxyAuthHeaders({} as any).catch(() => ({}));
    const backendRes = await fetch(`${backendOrigin()}/health`, {
      signal: AbortSignal.timeout(5000),
      headers,
    }).catch(() => null);

    if (!backendRes || !backendRes.ok) {
      return NextResponse.json(
        {
          status: 'degraded',
          message: 'Backend indisponible',
          timestamp: new Date().toISOString(),
          service: 'academia-helm-web',
          backend: 'unreachable',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'academia-helm-web',
        backend: 'ok',
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Health check failed',
        timestamp: new Date().toISOString(),
        service: 'academia-helm-web',
      },
      { status: 503 }
    );
  }
}

/**
 * HEAD = liveness du WEB uniquement (le conteneur Next répond), sans dépendance
 * backend — réservé aux health checks de plateforme. Pour l'état COMPLET
 * (backend inclus), utiliser GET : 200 = tout va bien, 503 = backend injoignable.
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
