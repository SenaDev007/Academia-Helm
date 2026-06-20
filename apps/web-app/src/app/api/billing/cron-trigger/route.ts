/**
 * Cron Trigger — appelé automatiquement par Vercel Cron (tous les jours à 06:00 UTC)
 *
 * Cette route appelle le backend NestJS /billing/cron/daily-check qui vérifie
 * tous les abonnements et envoie les notifications + applique les transitions.
 *
 * Vercel Cron envoie un header Authorization: Bearer <CRON_SECRET> automatiquement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vercel Cron envoie un header Authorization: Bearer <secret>
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET || 'academia-helm-cron-2026';

  // Vérifier le secret (soit via Authorization header, soit via query param)
  const querySecret = request.nextUrl.searchParams.get('secret');
  const isValid = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const API_BASE_URL = getApiBaseUrlForRoutes();
    const url = `${API_BASE_URL}/billing/cron/daily-check`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret,
      },
      signal: AbortSignal.timeout(30_000),
    });

    const data = await response.json();
    console.log('[Cron Trigger] Daily check result:', data);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[Cron Trigger] Error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger daily check', details: error.message },
      { status: 500 },
    );
  }
}

// Vercel Cron peut aussi envoyer des POST
export async function POST(request: NextRequest) {
  return GET(request);
}
