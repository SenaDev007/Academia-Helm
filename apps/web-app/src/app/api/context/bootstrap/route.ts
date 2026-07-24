/**
 * ============================================================================
 * CONTEXT BOOTSTRAP API ROUTE
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend /context/bootstrap
 *
 * ⚠️ Pattern standardisé : utilise bffFetch() + buildCacheHeaders()
 * Voir docs/CACHE_PERFORMANCE_PATTERN.md
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { bffFetch, buildCacheHeaders } from '@/lib/api/bff-fetch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Récupérer le token depuis les headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 }
      );
    }

    // Appeler l'API backend avec timeout 15s + cache: 'no-store'
    const response = await bffFetch('/context/bootstrap', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
      timeoutMs: 15000,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // ⚠️ Le bootstrap est propre à l'utilisateur — pas de cache CDN public.
    // Cache navigateur court (10s) pour éviter le spam pendant la navigation.
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=60',
      },
    });
  } catch (error: any) {
    console.error('Error in context bootstrap:', error);
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'timeout', message: 'Délai dépassé. Veuillez réessayer.' },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
