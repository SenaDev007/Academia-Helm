/**
 * Proxy sync API (push, pull, schema-hash, devices) vers le backend NestJS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  // getApiBaseUrl() se termine déjà par /api — ne pas dupliquer le segment /api
  return `${API_URL}/sync${path ? `/${path}` : ''}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = normalizeApiUrl(buildBackendUrl(path));
  const headers = await getProxyAuthHeaders(request);

  try {
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Sync API GET error:', e);
    return NextResponse.json({ error: 'Sync service unavailable' }, { status: 502 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = normalizeApiUrl(buildBackendUrl(path));
  const headers = await getProxyAuthHeaders(request);

  try {
    const body = await request.text();
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: body || undefined,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Sync API POST error:', e);
    return NextResponse.json({ error: 'Sync service unavailable' }, { status: 502 });
  }
}
