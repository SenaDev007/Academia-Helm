/**
 * Proxy sync API (push, pull, schema-hash, devices) vers le backend NestJS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return `${API_URL}/api/sync${path ? `/${path}` : ''}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = buildBackendUrl(path);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const cookie = request.headers.get('cookie');
  if (auth) headers['Authorization'] = auth;
  if (cookie) headers['cookie'] = cookie;

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
  const url = buildBackendUrl(path);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const cookie = request.headers.get('cookie');
  if (auth) headers['Authorization'] = auth;
  if (cookie) headers['cookie'] = cookie;

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
