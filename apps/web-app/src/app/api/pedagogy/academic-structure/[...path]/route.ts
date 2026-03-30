/**
 * Proxy API Structure académique (Module 2) vers le backend NestJS
 * Forward: levels, cycles, classes (GET, POST, PUT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

/** Cookies / session lus côté serveur : évite une réponse 401 si la route est traitée comme statique. */
export const dynamic = 'force-dynamic';

function buildBackendUrl(apiBase: string, pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return `${apiBase}/api/pedagogy/academic-structure${path ? `/${path}` : ''}`;
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
  method: string
) {
  const apiBase = getApiBaseUrlForRoutes();
  const url = new URL(buildBackendUrl(apiBase, pathSegments));
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
    console.error('Academic structure API error:', e);
    return NextResponse.json(
      { error: 'Service indisponible' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
