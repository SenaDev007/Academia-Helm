/**
 * Catch-all BFF proxy for the Canteen module.
 *
 * Forwards ALL /api/modules-complementaires/canteen/* requests to the backend
 * /modules-complementaires/canteen/* — handles GET, POST, PUT, DELETE, PATCH.
 *
 * ⭐ v3.6.0 offline-first : comble les trous des routes statiques (dashboard,
 * diets, suppliers, teachers-by-level…) qui 404aient côté BFF alors que le
 * backend Nest les sert — la page d'accueil Cantine peut enfin charger ses
 * stats same-origin, et le SW peut mettre ces réponses en cache offline.
 * Les routes statiques existantes (stats, menus, enrollments…) gardent la
 * priorité (Next.js résout la route spécifique avant le catch-all).
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
      .replace('/api/modules-complementaires/canteen/', '');
    const url = new URL(`${API_BASE_URL}/modules-complementaires/canteen/${path}`);
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
    console.error('Canteen BFF proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error', message: (error as Error).message },
      { status: 500 },
    );
  }
}
