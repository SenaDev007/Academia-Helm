/**
 * Health Check API Route
 *
 * Vérifie la santé du backend (Fly.io) ET de la base de données.
 * Utilisé par :
 *   - Le network-detection.service pour le ping périodique
 *   - Fly.io health checks (toutes les 30s)
 *   - Le composant DBHealthCheck pour afficher la page de maintenance
 */

import { NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET() {
  try {
    // Vérifier que le backend répond
    const headers = await getProxyAuthHeaders({} as any).catch(() => ({}));
    const backendRes = await fetch(normalizeApiUrl(`${API_URL}/health`), {
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

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
