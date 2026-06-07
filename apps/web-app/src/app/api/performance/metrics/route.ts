/**
 * Performance Metrics API Route
 *
 * Reçoit les métriques de performance côté client.
 * Le backend NestJS n'expose pas cette route ; on accepte et on retourne 200.
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/performance/metrics
 *
 * Accepte les métriques de performance (POST_LOGIN, MODULE_LOAD, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metrics } = body;

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return NextResponse.json(
        { error: 'Invalid metrics data' },
        { status: 400 }
      );
    }

    // En développement, log optionnel pour debug
    if (process.env.NODE_ENV === 'development' && metrics.length > 0) {
      const summary = metrics.map((m: any) => `${m.type}: ${m.duration?.toFixed(0)}ms`).join(', ');
      console.log('[Performance]', summary);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error processing performance metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
