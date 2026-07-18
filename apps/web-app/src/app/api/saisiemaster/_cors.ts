import { NextRequest, NextResponse } from 'next/server';

/**
 * SaisieMaster CORS helper.
 *
 * Le frontend SaisieMaster tourne sur saisiemaster.academiahelm.com mais
 * les routes BFF sont sur www.academiahelm.com. Il faut donc autoriser
 * le cross-origin.
 */
const ALLOWED_ORIGINS = [
  'https://saisiemaster.academiahelm.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

export function getSaisieMasterCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function saisieMasterOptionsResponse(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: getSaisieMasterCorsHeaders(request),
  });
}

export function saisieMasterJsonResponse(data: unknown, status: number, request: NextRequest): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: getSaisieMasterCorsHeaders(request),
  });
}
