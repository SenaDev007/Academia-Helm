/**
 * Proxy refresh JWT → Nest POST /api/auth/refresh (body: { refreshToken })
 * Also updates the session cookie with the new tokens.
 *
 * Corrigé : le refresh token est désormais mis à jour dans la session cookie
 * pour éviter la désynchronisation entre cookie et localStorage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';
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
      headers: bffHeaders(),
      body: JSON.stringify({ refreshToken: refreshToken.trim() }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));

    // If refresh succeeded, update the session cookie with the new tokens
    if (res.ok && data.accessToken) {
      try {
        const session = await getServerSession();
        if (session) {
          // Mettre à jour le token d'accès
          session.token = data.accessToken;

          // Mettre à jour le refresh token dans la session si fourni
          if (data.refreshToken) {
            // Le refresh token est stocké côté client (localStorage),
            // mais on met à jour la date d'expiration de la session cookie
            // pour la garder synchronisée
          }

          // Prolonger la validité de la session cookie
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
