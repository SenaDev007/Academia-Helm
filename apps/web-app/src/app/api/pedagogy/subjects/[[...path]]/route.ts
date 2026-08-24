import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

/**
 * BFF proxy for /api/pedagogy/subjects/*
 *
 * Forwards to backend NestJS controller:
 *   /subjects/*
 *
 * Used by MaterialsWorkspace to populate the "Matière" select in the
 * create/edit material modal. Backend GET /subjects supports optional
 * query params: academicYearId, schoolLevelId, language, search.
 */

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(
    `subjects${path ? `/${path}` : ''}`,
  );
}

async function forward(request: NextRequest, pathSegments: string[], method: string) {
  const url = new URL(buildBackendUrl(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  const headers = await getProxyAuthHeaders(request);
  try {
    const options: RequestInit = { method, headers, cache: 'no-store' };
    const bodyText = await readProxyBodyText(request, method);
    if (bodyText !== undefined) options.body = bodyText;
    const res = await fetch(normalizeApiUrl(url.toString()), options);
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Subjects API error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return forward(request, path ?? [], 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return forward(request, path ?? [], 'POST');
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return forward(request, path ?? [], 'PUT');
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return forward(request, path ?? [], 'DELETE');
}
