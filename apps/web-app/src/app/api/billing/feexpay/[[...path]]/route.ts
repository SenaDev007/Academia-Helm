/**
 * ============================================================================
 * PROXY API — BILLING FEEXPAY (catch-all)
 * ============================================================================
 *
 * Toutes les requêtes /api/billing/feexpay/* sont proxysées vers NestJS :
 *   /api/billing/feexpay/school-config        →  {API_BASE}/billing/feexpay/school-config
 *   /api/billing/feexpay/school-config/test   →  {API_BASE}/billing/feexpay/school-config/test
 *   /api/billing/feexpay/school-fees/pay-cash →  {API_BASE}/billing/feexpay/school-fees/pay-cash
 *   etc.
 *
 * Le webhook FeexPay (POST /webhook) est PUBLIC et passe par /api/webhooks/feexpay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`billing/feexpay${path ? `/${path}` : ''}`);
}

async function parseBackendJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: 'Réponse backend invalide' };
  }
}

async function forward(
  request: NextRequest,
  pathSegments: string[],
  method: string,
) {
  const url = new URL(buildBackendUrl(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = await getProxyAuthHeaders(request);

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };

    if (method !== 'GET' && method !== 'HEAD') {
      const text = await request.text();
      if (text.length > 0) {
        options.body = text;
      }
    }

    const res = await fetch(normalizeApiUrl(url.toString()), options);

    const data = await parseBackendJson(res);
    const response = NextResponse.json(data, { status: res.status });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('X-Accel-Buffering', 'no');
    return response;
  } catch (e) {
    console.error('FeexPay API proxy error:', e);
    return NextResponse.json(
      { error: 'Service FeexPay indisponible' },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
