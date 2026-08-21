/**
 * Proxy API → NestJS /timetable-engine/*
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

// ⭐ force-dynamic : empêche Vercel de statically-optimize/cacher cette route.
//    Sans ça, la config timetable peut être stale quand l'utilisateur modifie
//    les jours dans l'onglet Configuration puis passe à l'onglet Emploi du temps.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`timetable-engine${path ? `/${path}` : ''}`);
}

async function forward(request: NextRequest, pathSegments: string[], method: string) {
  const url = new URL(buildBackendUrl(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => { url.searchParams.append(key, value); });
  // ⭐ Cache-buster : ajoute un timestamp pour forcer le backend à renvoyer des données fraîches
  //    Sans ça, Vercel edge cache peut servir une config stale quand l'utilisateur
  //    modifie les jours dans l'onglet Configuration puis passe à l'onglet Emploi du temps.
  const headers = await getProxyAuthHeaders(request);
  if (!headers['Authorization'] && !headers['Cookie']) return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };
    const bodyText = await readProxyBodyText(request, method);
    if (bodyText !== undefined) options.body = bodyText;
    const res = await fetch(normalizeApiUrl(url.toString()), options);
    const data = await res.json().catch(() => ({}));
    // ⭐ no-store sur la réponse aussi — empêche Vercel edge cache de servir une config stale
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
  } catch (e) {
    console.error('[api/timetable-engine]', e);
    return NextResponse.json({ message: 'Service indisponible' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params; return forward(request, path ?? [], 'GET');
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params; return forward(request, path ?? [], 'POST');
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params; return forward(request, path ?? [], 'PUT');
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params; return forward(request, path ?? [], 'DELETE');
}
