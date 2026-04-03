/**
 * Proxy API Espace enseignant (Module 2) vers le backend NestJS
 * Forward: semainier, notifications, etc. (GET, POST, PUT)
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestDoublePrefixedControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestDoublePrefixedControllerUrl(
    `pedagogy/teacher${path ? `/${path}` : ''}`,
  );
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
  const headers = await getProxyAuthHeaders(request);

  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };
    const bodyText = await readProxyBodyText(request, method);
    if (bodyText !== undefined) {
      options.body = bodyText;
    }
    const res = await fetch(normalizeApiUrl(url.toString()), options);
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
