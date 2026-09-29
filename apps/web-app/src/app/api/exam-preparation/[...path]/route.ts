/**
 * BFF catch-all proxy for /api/exam-preparation/*
 * Forwards to backend /exam-preparation/* (module Préparation d'examen)
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) { return proxy(request, 'GET'); }
export async function POST(request: NextRequest) { return proxy(request, 'POST'); }
export async function PUT(request: NextRequest) { return proxy(request, 'PUT'); }
export async function DELETE(request: NextRequest) { return proxy(request, 'DELETE'); }

async function proxy(request: NextRequest, method: string) {
  try {
    const path = request.nextUrl.pathname.replace('/api/exam-preparation', '');
    const search = request.nextUrl.search;
    const targetUrl = normalizeApiUrl(`${API_URL}/exam-preparation${path}${search}`);
    const headers = await getProxyAuthHeaders(request);

    let body: string | undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      body = await request.text();
    }

    // ⭐ 60 s : les exports PDF (Puppeteer) peuvent être lents au démarrage
    //    à froid (navigateur + polices) — ne pas les couper à 15 s.
    const response = await fetchWithTimeout(targetUrl, {
      method,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body,
    }, 60_000);

    // ⭐ Handle binary responses (export PDF) — don't try to JSON.parse
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf') ||
        contentType.includes('spreadsheet') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('text/csv')) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': response.headers.get('content-disposition') || '',
        },
      });
    }

    const text = await response.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep as text */ }
    return NextResponse.json(data as any, { status: response.status });
  } catch (e: any) {
    console.error('[exam-preparation proxy]', e?.message);
    return NextResponse.json({ message: 'Proxy error' }, { status: 502 });
  }
}
