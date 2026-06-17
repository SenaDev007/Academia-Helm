/**
 * Logout API Route
 *
 * Déconnexion complète :
 * 1. Révoque le token JWT côté NestJS (best-effort, timeout 3s)
 * 2. Supprime les cookies de session (academia_session, academia_token, x-tenant-id)
 *
 * Important : la suppression des cookies est TOUJOURS exécutée, même si
 * le backend NestJS ne répond pas (cold start Fly.io, réseau, etc.).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearServerSession } from '@/lib/auth/session';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

export async function POST() {
  // ── 1. Révoquer le token côté NestJS (best-effort, timeout 3s) ──────
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('academia_token');

    if (tokenCookie?.value) {
      const base = normalizeApiUrl(
        getApiBaseUrlForRoutes().replace(/\/$/, ''),
      );
      const url = `${base}/auth/logout`;

      // Timeout de 3s — si le backend ne répond pas, on continue
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch(url, {
        method: 'POST',
        headers: bffHeaders({ Authorization: `Bearer ${tokenCookie.value}` }),
        signal: controller.signal,
      }).catch(() => {
        // Non-critique : les cookies seront supprimés de toute façon
      });

      clearTimeout(timeoutId);
    }
  } catch {
    // Non-critique : les cookies seront supprimés de toute façon
  }

  // ── 2. Supprimer les cookies de session (TOUJOURS exécuté) ──────────
  await clearServerSession();

  // ── 3. Double suppression : sans domain (au cas où le cookie aurait
  // été posé sans domain) ───────────────────────────────────────────────
  try {
    const cookieStore = await cookies();
    cookieStore.delete('academia_session');
    cookieStore.delete('academia_token');
    cookieStore.delete('x-tenant-id');
  } catch {
    // ignore
  }

  const response = NextResponse.json({ success: true });

  // Set-Cookie avec maxAge=0 pour forcer la suppression côté navigateur
  // (même si le cookie a été posé avec un domain différent)
  response.cookies.set('academia_session', '', { path: '/', maxAge: 0 });
  response.cookies.set('academia_token', '', { path: '/', maxAge: 0 });
  response.cookies.set('x-tenant-id', '', { path: '/', maxAge: 0 });

  return response;
}
