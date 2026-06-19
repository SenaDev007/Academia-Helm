/**
 * ============================================================================
 * PROXY API — DEPARTMENTS (root)
 * ============================================================================
 *
 * Handles /api/departments (no path segments) — redirects to the catch-all.
 * This is needed because Next.js App Router doesn't automatically fall through
 * from /api/departments to /api/departments/[...path] when the path is empty.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

async function handleRequest(
  request: NextRequest,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
) {
  try {
    const backendUrl = nestControllerUrl('departments');
    const search = request.nextUrl.search;
    const url = normalizeApiUrl(`${backendUrl}${search}`);

    const headers = await getProxyAuthHeaders(request);

    const fetchInit: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };

    if (method === 'POST' || method === 'PATCH') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.text();
        fetchInit.body = body;
        (fetchInit.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchInit);
    const text = await response.text();
    let data: any = null;
    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    const res = NextResponse.json(data, { status: response.status });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res;
  } catch (error: any) {
    console.error(`[departments-proxy-root] ${method} error:`, error.message);
    return NextResponse.json(
      { error: 'Departments service unavailable', detail: error.message },
      { status: 502 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleRequest(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST');
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request, 'PATCH');
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request, 'DELETE');
}
