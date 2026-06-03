/**
 * ============================================================================
 * PROXY API — MODULE RH (catch-all)
 * ============================================================================
 *
 * Même pattern que /api/pedagogy/academic-structure/[...path]/route.ts :
 *   - getProxyAuthHeaders → résout JWT + tenant côté serveur
 *   - nestControllerUrl   → construit l'URL NestJS sans double préfixe /api
 *   - readProxyBodyText   → relay body brut (évite les problèmes de parsing)
 *
 * Toutes les requêtes /api/hr/* sont proxysées vers NestJS :
 *   /api/hr/staff?tenantId=...  →  {API_BASE}/hr/staff?tenantId=...
 *   /api/hr/contracts/123       →  {API_BASE}/hr/contracts/123
 *   etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

/** Force dynamique — les cookies / session doivent être lus côté serveur. */
export const dynamic = 'force-dynamic';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`hr${path ? `/${path}` : ''}`);
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
    const bodyText = await readProxyBodyText(request, method);
    if (bodyText !== undefined) {
      options.body = bodyText;
    }
    const res = await fetch(normalizeApiUrl(url.toString()), options);
    const data = await parseBackendJson(res);
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('HR API proxy error:', e);
    return NextResponse.json(
      { error: 'Service RH indisponible' },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
