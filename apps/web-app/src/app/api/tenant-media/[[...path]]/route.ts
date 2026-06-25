/**
 * ============================================================================
 * Proxy API → NestJS /tenant-media/*
 * ============================================================================
 *
 * Bibliothèque médias tenant-scoped (upload, list, get, update, delete,
 * usage tracking, cleanup orphelins).
 *
 * Endpoints proxyés :
 *   POST   /api/tenant-media                  → upload (data URL + métadonnées)
 *   GET    /api/tenant-media                  → liste paginée (?folder=&type=&search=&limit=&offset=)
 *   GET    /api/tenant-media/folders          → liste des dossiers
 *   GET    /api/tenant-media/:id              → détail
 *   PUT    /api/tenant-media/:id              → update (alt, tags, folder, name)
 *   DELETE /api/tenant-media/:id              → suppression
 *   POST   /api/tenant-media/:id/use          → incrémente usage
 *   POST   /api/tenant-media/:id/unuse        → décrémente usage
 *   POST   /api/tenant-media/cleanup-orphans  → nettoyage storage
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`tenant-media${path ? `/${path}` : ''}`);
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
  if (!headers['Authorization'] && !headers['Cookie']) {
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
    console.error('[api/tenant-media]', e);
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}
