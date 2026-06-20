/**
 * ============================================================================
 * PROXY API — PLATFORM BACK-OFFICE (catch-all)
 * ============================================================================
 *
 * Toutes les requêtes /api/platform/* sont proxysées vers NestJS :
 *   /api/platform/dashboard    →  {API_BASE}/platform/dashboard
 *   /api/platform/tenants      →  {API_BASE}/platform/tenants
 *   etc.
 *
 * AUTHENTIFICATION :
 *   Le proxy vérifie le cookie `academia_admin_session` directement depuis
 *   la requête (request.cookies) plutôt que via next/headers cookies().
 *   Cette approche est plus fiable dans Vercel Edge/Serverless.
 *
 *   Si l'admin est authentifié, le proxy ajoute le header
 *   `x-platform-admin-email` à la requête backend.
 *
 *   Si l'admin n'est PAS authentifié → 401 (avant d'atteindre le backend).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { verifyAdminSession } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

/**
 * Vérifie que l'admin est authentifié et construit les headers à envoyer
 * au backend. Retourne null si non authentifié (→ 401).
 *
 * Lit le cookie directement depuis la requête (request.cookies) plutôt que
 * via next/headers cookies() qui peut être instable en serverless Vercel.
 */
function getPlatformProxyHeaders(request: NextRequest): Record<string, string> | null {
  const cookie = request.cookies.get('academia_admin_session')?.value;
  if (!cookie) {
    return null;
  }

  try {
    const decoded = JSON.parse(decodeURIComponent(cookie));
    const session = verifyAdminSession(decoded);
    if (!session) {
      return null;
    }

    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js platform proxy)',
      'x-platform-admin-email': session.user.email,
      'x-platform-admin-id': session.user.id,
      'x-platform-admin-role': session.user.role || 'PLATFORM_SUPER_ADMIN',
    };
  } catch {
    return null;
  }
}

function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Non authentifié. Veuillez vous connecter au back-office.' },
    { status: 401 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = getPlatformProxyHeaders(request);
  if (!headers) return unauthorizedResponse();

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

  const headers = getPlatformProxyHeaders(request);
  if (!headers) return unauthorizedResponse();

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = getPlatformProxyHeaders(request);
  if (!headers) return unauthorizedResponse();

  let body: any = undefined;
  try {
    body = await request.text();
  } catch {
    /* no body */
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers,
      body,
      cache: 'no-store',
    });

    const data = await parseBackendJson(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[platform/proxy] PATCH error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du proxy platform' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = getPlatformProxyHeaders(request);
  if (!headers) return unauthorizedResponse();

  try {
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers,
      cache: 'no-store',
    });

    const data = await parseBackendJson(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[platform/proxy] DELETE error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du proxy platform' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = getPlatformProxyHeaders(request);
  if (!headers) return unauthorizedResponse();

  let body: any = undefined;
  try {
    body = await request.text();
  } catch {
    /* no body */
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers,
      body,
      cache: 'no-store',
    });

    const data = await parseBackendJson(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[platform/proxy] PUT error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du proxy platform' },
      { status: 500 },
    );
  }
}
