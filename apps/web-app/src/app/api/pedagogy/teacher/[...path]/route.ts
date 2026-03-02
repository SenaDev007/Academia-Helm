/**
 * Proxy API Espace enseignant (Module 2) vers le backend NestJS
 * Forward: semainier, notifications, etc. (GET, POST, PUT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return `${API_URL}/api/pedagogy/teacher${path ? `/${path}` : ''}`;
}

async function forward(
  request: NextRequest,
  pathSegments: string[],
  method: string
) {
  const url = new URL(buildBackendUrl(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  const cookie = request.headers.get('cookie');
  const tenantId = request.headers.get('x-tenant-id');
  if (auth) (headers as Record<string, string>)['Authorization'] = auth;
  if (cookie) (headers as Record<string, string>)['cookie'] = cookie;
  if (tenantId) (headers as Record<string, string>)['X-Tenant-ID'] = tenantId;

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };
    if (method !== 'GET' && request.body) {
      options.body = await request.text();
    }
    const res = await fetch(url.toString(), options);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Pedagogy teacher API error:', e);
    return NextResponse.json(
      { error: 'Service indisponible' },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
