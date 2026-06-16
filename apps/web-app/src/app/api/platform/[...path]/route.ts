/**
 * ============================================================================
 * PROXY API — PLATFORM BACK-OFFICE (catch-all)
 * ============================================================================
 *
 * Toutes les requêtes /api/platform/* sont proxysées vers NestJS :
 *   /api/platform/dashboard    →  {API_BASE}/platform/dashboard
 *   /api/platform/tenants      →  {API_BASE}/platform/tenants
 *   /api/platform/audit-logs   →  {API_BASE}/platform/audit-logs
 *   etc.
 *
 * L'authentification (JWT cookie + rôle PLATFORM_OWNER) est vérifiée côté
 * backend (PlatformController + JwtAuthGuard + assertPlatformRole).
 *
 * Ce proxy ne fait que forwarder la requête en ajoutant les headers
 * d'authentification (cookies + Authorization Bearer).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`platform${path ? `/${path}` : ''}`);
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

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = await getProxyAuthHeaders(request);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const data = await parseBackendJson(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[platform/proxy] GET error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du proxy platform' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = await getProxyAuthHeaders(request);
  let body: any = undefined;
  try {
    body = await request.text();
  } catch {
    /* no body */
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });

    const data = await parseBackendJson(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[platform/proxy] POST error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du proxy platform' },
      { status: 500 },
    );
  }
}
