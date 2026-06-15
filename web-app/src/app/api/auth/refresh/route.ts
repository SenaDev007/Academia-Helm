/**
 * Proxy refresh JWT → Nest POST /api/auth/refresh (body: { refreshToken })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const refreshToken = body?.refreshToken as string | undefined;
    if (!refreshToken?.trim()) {
      return NextResponse.json({ message: 'refreshToken requis' }, { status: 400 });
    }

    const base = normalizeApiUrl(getApiBaseUrlForRoutes().replace(/\/$/, ''));
    const url = `${base}/auth/refresh`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken.trim() }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[auth/refresh]', e);
    return NextResponse.json({ message: 'Service indisponible' }, { status: 502 });
  }
}
