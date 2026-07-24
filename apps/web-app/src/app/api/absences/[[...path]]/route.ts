/**
 * API PROXY — Absences (catch-all)
 *
 * Forward toutes les requêtes vers le backend NestJS /absences/*
 *   GET    /api/absences                    → liste (filtres: studentId, classId, startDate, endDate)
 *   POST   /api/absences                    → créer une absence
 *   GET    /api/absences/:id                → détail
 *   PATCH  /api/absences/:id                → justifier / modifier
 *   DELETE /api/absences/:id                → supprimer
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

async function forward(request: NextRequest, pathSegments: string[], method: string) {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  const url = new URL(`${API_URL}/absences${path ? `/${path}` : ''}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  const headers = await getProxyAuthHeaders(request);

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };
    if (method !== 'GET' && method !== 'DELETE') {
      const bodyText = await request.text();
      if (bodyText) options.body = bodyText;
    }
    const res = await fetch(normalizeApiUrl(url.toString()), options);
    const text = await res.text();
    let data: unknown = {};
    if (text.trim()) {
      try { data = JSON.parse(text); } catch { data = { error: 'Réponse backend invalide' }; }
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Absences API error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
