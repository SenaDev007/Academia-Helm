import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, bffHeaders } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

/* ══════════════════════════════════════════════════════════════════════
   BFF ACADEMIA COMMUNITY — proxy catch-all /api/community/*

   Rôle :
   - Porte le JWT communauté dans un cookie httpOnly `community_token`
     (jamais de token exposé au JS client)
   - Proxy GET/POST/PATCH/DELETE vers /api/community/* (api-server)
   - login/register : pose le cookie ; logout : le retire
   - Timeouts cohérents avec l'audit perf 2026-09-07 (15 s lectures /
     30 s mutations — fetchWithTimeout gère aussi le retry passerelle)

   Les routes d'écriture ne sont JAMAIS mises en cache (dynamic).
   ══════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'community_token';
const COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 jours (aligné sur le JWT)

/** Endpoints qui renvoient un token à stocker dans le cookie */
const TOKEN_ENDPOINTS = new Set(['auth/login', 'auth/register']);

/** Endpoints d'auth (pas de token requis côté proxy) */
const PUBLIC_ENDPOINTS = new Set(['auth/login', 'auth/register', 'public/overview', 'public/contact']);

async function proxy(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
) {
  if (!path || path.includes('..')) {
    return NextResponse.json({ message: 'Chemin communautaire invalide' }, { status: 400 });
  }

  const isRead = method === 'GET';
  const timeout = isRead ? 15_000 : 30_000;

  // Corps (mutations uniquement)
  let body: string | undefined;
  if (!isRead && method !== 'DELETE') {
    try {
      body = JSON.stringify(await request.json());
    } catch {
      body = undefined;
    }
  }

  // Query string
  const { search } = new URL(request.url);

  // Headers : Authorization depuis le cookie httpOnly
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const headers: Record<string, string> = bffHeaders();
  if (token && !PUBLIC_ENDPOINTS.has(path)) {
    headers.Authorization = `Bearer ${token}`;
  }

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      `${nestControllerUrl(`community/${path}`)}${search}`,
      { method, headers, body },
      timeout,
    );
  } catch {
    return NextResponse.json(
      { message: 'Service communauté momentanément indisponible — réessayez' },
      { status: 502 },
    );
  }

  // Copie du statut + du corps JSON
  let data: any = null;
  const text = await upstream.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text.slice(0, 500) };
  }

  // ⭐ login/register : le backend renvoie { token, member } → cookie httpOnly
  if (TOKEN_ENDPOINTS.has(path) && upstream.ok && data?.token) {
    const response = NextResponse.json(
      { member: data.member, pending: data.pending ?? false },
      { status: upstream.status },
    );
    response.cookies.set(COOKIE_NAME, data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });
    return response; // le token ne part jamais côté client
  }

  const response = NextResponse.json(data, { status: upstream.status });

  // ⭐ logout : retire le cookie
  if (path === 'auth/logout') {
    response.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  }

  return response;
}

/** Next 16 : params est une Promise — chemin wildcard reconstruit */
async function resolvePath(params: Promise<{ path?: string[] }>): Promise<string> {
  const { path: segments } = await params;
  return (segments ?? []).join('/');
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, 'GET', await resolvePath(ctx.params));
}
export async function POST(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, 'POST', await resolvePath(ctx.params));
}
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, 'PATCH', await resolvePath(ctx.params));
}
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, 'DELETE', await resolvePath(ctx.params));
}
