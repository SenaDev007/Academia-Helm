/**
 * ============================================================================
 * Proxy API → NestJS /tenant-theme/*
 * ============================================================================
 *
 * Gestion du thème du site institutionnel d'un tenant.
 *
 * Endpoints proxyés :
 *   GET  /api/tenant-theme                  → settings actuels (auth)
 *   PUT  /api/tenant-theme                  → met à jour themeId + mode (auth)
 *   GET  /api/tenant-theme/public/:slug     → settings publics par slug (no auth)
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`tenant-theme${path ? `/${path}` : ''}`);
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

  // Les endpoints /public/* n'ont pas besoin d'auth
  const isPublic = pathSegments[0] === 'public';
  const headers = await getProxyAuthHeaders(request);

  if (!isPublic && !headers['Authorization'] && !headers['Cookie']) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
  }

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };
    const bodyText = await readProxyBodyText(request, method);
    if (bodyText !== undefined) {
      options.body = bodyText;
    }
    const res = await fetch(normalizeApiUrl(url.toString()), options);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[api/tenant-theme]', e);
    return NextResponse.json({ message: 'Service indisponible' }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}
