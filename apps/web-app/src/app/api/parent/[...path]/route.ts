/**
 * BFF catch-all proxy for /api/parent/*
 * Forwards to backend /parent/*
 * Handles binary responses (PDF receipts) correctly.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) { return proxy(request, 'GET'); }
export async function POST(request: NextRequest) { return proxy(request, 'POST'); }
export async function PUT(request: NextRequest) { return proxy(request, 'PUT'); }
export async function DELETE(request: NextRequest) { return proxy(request, 'DELETE'); }

async function proxy(request: NextRequest, method: string) {
  try {
    const path = request.nextUrl.pathname.replace('/api/parent', '');
    const search = request.nextUrl.search;
    const targetUrl = normalizeApiUrl(`${API_URL}/parent${path}${search}`);
    const headers = await getProxyAuthHeaders(request);

    let body: string | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      body = await request.text();
    }

    const response = await fetch(targetUrl, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
    });

    const contentType = response.headers.get('Content-Type') || '';
    const isBinary = contentType.includes('application/pdf') ||
                     contentType.includes('application/zip') ||
                     contentType.includes('application/octet-stream');

    if (isBinary) {
      const arrayBuffer = await response.arrayBuffer();
      const responseHeaders = new Headers();
      responseHeaders.set('Content-Type', contentType);
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        responseHeaders.set('Content-Disposition', contentDisposition);
      }
      return new NextResponse(arrayBuffer, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try { data = JSON.parse(raw); }
      catch { return NextResponse.json({ error: 'Invalid response', raw }, { status: 502 }); }
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[parent] proxy error:', error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
