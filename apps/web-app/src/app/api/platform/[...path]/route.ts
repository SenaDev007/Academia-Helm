/**
 * ============================================================================
 * PROXY API — PLATFORM BACK-OFFICE (catch-all) — VERSION ROBUSTE
 * ============================================================================
 *
 * Version alternative qui lit le cookie admin directement depuis la requête
 * HTTP brute (request.headers.get('cookie')) au lieu d'utiliser next/headers
 * ou request.cookies qui peuvent être instables en serverless Vercel.
 *
 * Si le cookie n'est pas trouvé via cette méthode, on tente aussi request.cookies
 * en fallback.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { verifyAdminSession } from '@/lib/admin/admin-auth-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`platform${path ? `/${path}` : ''}`);
}

/**
 * Extrait le cookie academia_admin_session de la requête en lisant
 * directement le header Cookie brut. Plus fiable que request.cookies
 * en serverless Vercel.
 */
function extractAdminCookie(request: NextRequest): string | null {
  // Méthode 1 : request.cookies (Next.js API)
  try {
    const cookie = request.cookies.get('academia_admin_session')?.value;
    if (cookie) return cookie;
  } catch {
    /* fallback */
  }

  // Méthode 2 : lire le header Cookie brut
  try {
    const rawCookie = request.headers.get('cookie') || '';
    const match = rawCookie.match(/academia_admin_session=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    /* fallback */
  }

  return null;
}

function getPlatformProxyHeaders(request: NextRequest): Record<string, string> | null {
  const cookieValue = extractAdminCookie(request);
  if (!cookieValue) {
    return null;
  }

  try {
    const decoded = JSON.parse(cookieValue);
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

async function parseBackendJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: 'Réponse backend invalide', raw: text.slice(0, 500) };
  }
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] },
  method: string,
) {
  const url = new URL(buildBackendUrl(params.path));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers = getPlatformProxyHeaders(request);
  if (!headers) return unauthorizedResponse();

  let body: any = undefined;
  if (method !== 'GET' && method !== 'DELETE') {
    try {
      body = await request.text();
    } catch {
      /* no body */
    }
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body,
      cache: 'no-store',
    });

    const data = await parseBackendJson(response);
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error(`[platform/proxy] ${method} error:`, error?.message);
    return NextResponse.json(
      {
        error: error?.message || 'Erreur interne du proxy platform',
        url: url.toString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params, 'POST');
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params, 'DELETE');
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params, 'PUT');
}
