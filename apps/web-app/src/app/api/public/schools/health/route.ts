/**
 * ============================================================================
 * SCHOOLS HEALTH CHECK - DIAGNOSTIC DE CONNECTIVITÉ API
 * ============================================================================
 *
 * Endpoint de diagnostic pour vérifier que le backend NestJS est accessible.
 * Retourne des informations détaillées sur la connexion pour aider au debug.
 * ⚠️ Ne pas utiliser en production pour des données sensibles — debug uniquement.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(_request: NextRequest) {
  const startTime = Date.now();
  const apiUrl = nestControllerUrl('public/schools/list');
  const baseUrl = getApiBaseUrlForRoutes();

  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    bff: {
      status: 'ok',
      apiBaseUrl: baseUrl.replace(/\/\/[^/]+/, '//***'),  // Masquer le domaine
      targetUrl: apiUrl.replace(/\/\/[^/]+/, '//***'),
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    result.backend = {
      status: response.status,
      statusText: response.statusText,
      elapsedMs: elapsed,
      headers: {
        'cross-origin-resource-policy': response.headers.get('cross-origin-resource-policy'),
        'cross-origin-embedder-policy': response.headers.get('cross-origin-embedder-policy'),
        'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
        'content-type': response.headers.get('content-type'),
      },
    };

    if (response.ok) {
      const data = await response.json();
      result.backend.dataCount = Array.isArray(data) ? data.length : 'not-array';
      result.overall = 'healthy';
    } else {
      const errorData = await response.json().catch(() => null);
      result.backend.error = errorData;
      result.overall = response.status === 403 ? 'forbidden' : 'unhealthy';
    }
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    result.backend = {
      error: error.message,
      name: error.name,
      elapsedMs: elapsed,
    };
    result.overall = 'unreachable';
  }

  const status = result.overall === 'healthy' ? 200 : 503;
  return NextResponse.json(result, { status });
}
