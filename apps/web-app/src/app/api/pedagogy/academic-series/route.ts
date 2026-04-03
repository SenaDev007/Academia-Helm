/**
 * Proxy racine — GET/POST /api/pedagogy/academic-series (sans segment de chemin)
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestDoublePrefixedControllerUrl, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { readProxyBodyText } from '@/lib/api/pedagogy-proxy-body';

async function forward(request: NextRequest, method: string) {
  const url = new URL(nestDoublePrefixedControllerUrl('pedagogy/academic-series'));
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
    console.error('Academic series API error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return forward(request, 'GET');
}

export async function POST(request: NextRequest) {
  return forward(request, 'POST');
}
