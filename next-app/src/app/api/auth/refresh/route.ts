/**
 * Proxy refresh JWT → Nest POST /api/auth/refresh (body: { refreshToken })
 * Also updates the session cookie with the new tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getServerSession, setServerSession } from '@/lib/auth/session';

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

    // If refresh succeeded, update the session cookie with the new access token
    if (res.ok && data.accessToken) {
      try {
        const session = await getServerSession();
        if (session) {
          session.token = data.accessToken;
          if (data.refreshToken) {
            // Keep the same session structure, just update tokens
          }
          session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          await setServerSession(session);
        }
      } catch (cookieErr) {
        // Non-critical: the client-side localStorage already has the new token
        console.warn('[auth/refresh] Failed to update session cookie:', cookieErr);
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[auth/refresh]', e);
    return NextResponse.json({ message: 'Service indisponible' }, { status: 502 });
  }
}
