/**
 * Health Check API Route
 *
 * Utilisé par le network-detection.service pour le ping périodique.
 * Supporte HEAD (léger) et GET (avec détails).
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'academia-helm-web',
    },
    { status: 200 }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
