/**
 * ============================================================================
 * PROXY API — ADMISSION SETTINGS (catch-all)
 * ============================================================================
 * Proxy for /api/admission-settings/* → NestJS AdmissionSettingsController.
 * Auth routes require JWT + tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`admission-settings${path ? `/${path}` : ''}`);
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // All admission-settings routes require auth (no public routes here)
  const authHeaders = await getProxyAuthHeaders(request);
  Object.assign(headers, authHeaders);

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };

    if (method !== 'GET' && method !== 'HEAD') {
      const text = await request.text();
      if (text.length > 0) {
        options.body = text;
      }
    }

    const res = await fetchWithTimeout(url.toString(), options, 15000);
    const body = await res.text();

    const responseHeaders: Record<string, string> = {
      'Content-Type': res.headers.get('Content-Type') || 'application/json',
    };

    return new NextResponse(body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('[admission-settings proxy]', err?.message);
    return NextResponse.json(
      { error: err?.message || 'Proxy error' },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const p = await params;
  return forward(request, p.path || [], 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const p = await params;
  return forward(request, p.path || [], 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const p = await params;
  return forward(request, p.path || [], 'PUT');
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const p = await params;
  return forward(request, p.path || [], 'DELETE');
}
