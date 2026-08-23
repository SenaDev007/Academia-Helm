/**
 * ⭐ BFF route pour /api/pedagogy/monthly-plans/*
 *    Proxie vers le backend NestJS /pedagogy/monthly-plans/*
 *
 * Endpoints :
 *   GET   /api/pedagogy/monthly-plans?academicYearId=Y&classLevel=CM2&month=Octobre&teacherId=T
 *   POST  /api/pedagogy/monthly-plans/auto-propose    body: { academicYearId, classLevel, month }
 *   POST  /api/pedagogy/monthly-plans/save            body: { cells, ... }
 *   PUT   /api/pedagogy/monthly-plans/:id             body: { content?, activityType?, ... }
 *
 * Terminologie SA/Séquence/U/D :
 *   - SA = Situation d'Apprentissage (SA1, SA2, SA3)
 *   - Séquence = séquence pédagogique (séq 1, séq 2, ...) — séance de classe
 *   - U = Unité (U1, U2)
 *   - D = Dossier (D1, D2)
 */
import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const queryString = url.search;
  const pathStr = path ? path.join('/') : '';
  const targetUrl = nestControllerUrl(`pedagogy/monthly-plans${pathStr ? '/' + pathStr : ''}${queryString}`);

  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(targetUrl, { headers, cache: 'no-store' });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch monthly plans' }, { status: response.status });
  }
  return NextResponse.json(await response.json());
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const queryString = url.search; // ⭐ FIX Issue 6: forward query string (academicYearId, classLevel, month, teacherId) — same pattern as GET
  const pathStr = path ? path.join('/') : '';
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`pedagogy/monthly-plans${pathStr ? '/' + pathStr : ''}${queryString}`),
    { method: 'POST', headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(err, { status: response.status });
  }
  return NextResponse.json(await response.json());
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const queryString = url.search; // ⭐ FIX Issue 6: forward query string — same pattern as GET
  const pathStr = path ? path.join('/') : '';
  const body = await request.json();
  const headers = await getProxyAuthHeaders(request);
  const response = await fetch(
    nestControllerUrl(`pedagogy/monthly-plans${pathStr ? '/' + pathStr : ''}${queryString}`),
    { method: 'PUT', headers, body: JSON.stringify(body) }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return NextResponse.json(err, { status: response.status });
  }
  return NextResponse.json(await response.json());
}
