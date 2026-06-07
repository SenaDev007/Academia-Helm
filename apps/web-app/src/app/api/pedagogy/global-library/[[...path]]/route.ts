/**
 * Proxy API Global Library (Bibliothèque Globale) vers le backend NestJS
 *
 * Endpoints proxyés :
 *   - GET    /api/pedagogy/global-library           → Liste des ressources globales
 *   - GET    /api/pedagogy/global-library/:id        → Détail d'une ressource
 *   - POST   /api/pedagogy/global-library            → Créer (PLATFORM_OWNER/ADMIN)
 *   - PATCH  /api/pedagogy/global-library/:id        → Modifier
 *   - DELETE /api/pedagogy/global-library/:id         → Supprimer
 *   - POST   /api/pedagogy/global-library/:id/usage   → Logger utilisation
 *   - POST   /api/pedagogy/global-library/:id/annotation → Upsert annotation
 *   - GET    /api/pedagogy/global-library/:id/annotation/:staffId → Annotation staff
 *   - GET    /api/pedagogy/global-library/stats/most-used → Stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(
    `pedagogy/global-library${path ? `/${path}` : ''}`,
  );
}

async function forward(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const url = new URL(buildBackendUrl(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  const headers = await getProxyAuthHeaders(request);

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
    console.error('Global Library API error:', e);
    return NextResponse.json({ error: 'Service unavailable' }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
