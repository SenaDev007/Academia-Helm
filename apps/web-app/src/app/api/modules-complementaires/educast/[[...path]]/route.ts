/**
 * Catch-all BFF proxy for the EduCast module.
 *
 * Forwards ALL /api/modules-complementaires/educast/* requests to the backend
 * /modules-complementaires/educast/* — handles GET, POST, PUT, DELETE, PATCH.
 *
 * ⭐ v3.6.0 offline-first : le BFF n'exposait que `contents` et `stats`, alors
 * que la page EduCast appelle same-origin favorites, stats-extended,
 * teacher-earnings, settings et media/:id/comments → 404 silencieux (vues
 * vides même EN LIGNE). Le backend Nest sert tous ces endpoints — ce
 * catch-all (même pattern que Shop) les rend accessibles ET cachables par
 * le Service Worker pour le mode hors ligne.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  return proxy(request);
}
export async function POST(request: NextRequest) {
  return proxy(request);
}
export async function PUT(request: NextRequest) {
  return proxy(request);
}
export async function PATCH(request: NextRequest) {
  return proxy(request);
}
export async function DELETE(request: NextRequest) {
  return proxy(request);
}

async function proxy(request: NextRequest): Promise<NextResponse> {
  try {
    const path = request.nextUrl.pathname
      .replace('/api/modules-complementaires/educast/', '');
    const url = new URL(`${API_BASE_URL}/modules-complementaires/educast/${path}`);
    // Forward query params
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    const headers = await getProxyAuthHeaders(request);
    const method = request.method;
    const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const body = hasBody ? await request.text() : undefined;
    const response = await fetch(url.toString(), {
      method,
      headers: {
        ...headers,
        ...(hasBody && body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(hasBody && body ? { body } : {}),
    });
    const text = await response.text();
    if (!text.trim()) {
      return NextResponse.json({ success: true }, { status: response.status });
    }
    try {
      return NextResponse.json(JSON.parse(text), { status: response.status });
    } catch {
      return new NextResponse(text, { status: response.status });
    }
  } catch (error) {
    console.error('EduCast BFF proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', message: (error as Error).message },
      { status: 500 },
    );
  }
}
