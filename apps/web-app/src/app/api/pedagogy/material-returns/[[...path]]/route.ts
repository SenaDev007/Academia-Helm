import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

/**
 * BFF proxy for /api/pedagogy/material-returns/*
 *
 * Forwards to backend NestJS controller:
 *   /pedagogy/material-returns/*
 *
 * All responses are no-store (volatile — teachers submit returns at any time,
 * directors validate at any time, must reflect changes immediately).
 */

function buildBackendUrl(pathSegments: string[]): string {
  const path = pathSegments.length ? pathSegments.join('/') : '';
  return nestControllerUrl(
    `pedagogy/material-returns${path ? `/${path}` : ''}`,
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

    // ⭐ Handle binary responses (PDF exports: inventory-pdf, distribution-pdf, my-receipt-pdf)
    //    Sans cette branche, le BFF essaie de JSON.parse le buffer PDF → échec → body "{}"
    //    → frontend affiche "Échec de chargement du document PDF".
    const contentType = res.headers.get('content-type') || '';
    if (
      contentType.includes('application/pdf') ||
      contentType.includes('spreadsheet') ||
      contentType.includes('application/octet-stream') ||
      contentType.includes('text/csv')
    ) {
      const buffer = await res.arrayBuffer();
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': res.headers.get('content-disposition') || '',
        },
      });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Material returns API error:', e);
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  return forward(request, path ?? [], 'PATCH');
}
