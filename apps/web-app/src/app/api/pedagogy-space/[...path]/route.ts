/**
 * BFF catch-all proxy for /api/pedagogy-space/*
 * Forwards to backend /pedagogy-space/*
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
    const path = request.nextUrl.pathname.replace('/api/pedagogy-space', '');
    const search = request.nextUrl.search;
    const targetUrl = normalizeApiUrl(`${API_URL}/pedagogy-space${path}${search}`);
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

    // ⭐ Handle binary responses (export Excel/PDF) — don't try to JSON.parse
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

    const raw = await response.text();
    let data: unknown = null;
    if (raw) {
      try { data = JSON.parse(raw); }
      catch { return NextResponse.json({ error: 'Invalid response', raw }, { status: 502 }); }
    }

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }

    // ⭐ Cache control conditionnel :
    //    - Les données d'appel (attendance) sont VOLATILES : un enseignant peut
    //      marquer un élève absent à 8h, puis revenir à 14h pour marquer l'après-midi.
    //      Si on cache le GET /attendance pendant 60s, le second affichage montrait
    //      une version STALE (élève "présent" alors qu'il est absent) → le second
    //      save écrasait le premier avec des PRESENT par défaut.
    //      → no-store pour /attendance (GET et POST).
    //    - Les autres endpoints (cahier journal, fiches, registres mensuels) sont
    //      moins volatils → cache 60s + stale-while-revalidate 300s acceptable.
    const isAttendancePath = path.startsWith('/attendance');
    const cacheControl = isAttendancePath
      ? 'no-store, max-age=0'
      : 'public, s-maxage=60, stale-while-revalidate=300';

    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': cacheControl } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[pedagogy-space] proxy error:', error);
    return NextResponse.json({ error: 'Internal server error', message }, { status: 500 });
  }
}
