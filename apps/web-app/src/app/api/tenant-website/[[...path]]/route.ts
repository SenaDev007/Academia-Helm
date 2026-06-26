/**
 * ============================================================================
 * PROXY API — TENANT WEBSITE (catch-all)
 * ============================================================================
 *
 * Proxy for /api/tenant-website/* → NestJS TenantWebsiteController.
 * Auth routes (GET/PUT/POST/DELETE without 'public') require JWT + tenant.
 * Public routes (/public/:tenantSlug/*) are @Public() on the backend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`tenant-website${path ? `/${path}` : ''}`);
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

  // Public routes don't need auth headers
  const isPublicRoute = pathSegments[0] === 'public';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!isPublicRoute) {
    const authHeaders = await getProxyAuthHeaders(request);
    Object.assign(headers, authHeaders);
  }

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };

    if (method !== 'GET' && method !== 'HEAD') {
      const text = await request.text();
      if (text.length > 0) {
        options.body = text;
      }
    }

    const res = await fetch(normalizeApiUrl(url.toString()), options);

    const text = await res.text();
    let data: any = {};
    if (text.trim()) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }

    const response = NextResponse.json(data, { status: res.status });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (e) {
    console.error('Tenant Website API proxy error:', e);
    return NextResponse.json(
      { error: 'Service site institutionnel indisponible' },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
