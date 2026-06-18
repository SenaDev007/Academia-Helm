/**
 * ============================================================================
 * PROXY API — DEPARTMENTS (catch-all)
 * ============================================================================
 *
 * Proxies all /api/departments/* requests to the NestJS backend.
 * Supports GET, POST, PATCH, DELETE.
 *
 *   /api/departments          →  {API_BASE}/departments
 *   /api/departments/:id      →  {API_BASE}/departments/:id
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(`departments${path ? `/${path}` : ''}`);
}

async function handleRequest(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
) {
  try {
    const { path: pathSegments = [] } = await context.params;
    const backendUrl = buildBackendUrl(pathSegments);
    const search = request.nextUrl.search;
    const url = normalizeApiUrl(`${backendUrl}${search}`);

    const headers = await getProxyAuthHeaders(request);

    const fetchInit: RequestInit = {
      method,
      headers,
      cache: 'no-store',
    };

    // For POST/PATCH, forward the body
    if (method === 'POST' || method === 'PATCH') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.text();
        fetchInit.body = body;
        (fetchInit.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchInit);

    // Try to parse JSON, fall back to text
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
    console.error(`[departments-proxy] ${method} error:`, error.message);
    return NextResponse.json(
      { error: 'Departments service unavailable', detail: error.message },
      { status: 502 },
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return handleRequest(request, context, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return handleRequest(request, context, 'POST');
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return handleRequest(request, context, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  return handleRequest(request, context, 'DELETE');
}
