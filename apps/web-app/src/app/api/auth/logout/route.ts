/**
 * Logout API Route
 *
 * Déconnexion complète :
 * 1. Révoque le token JWT côté NestJS (ajout dans revoked_tokens)
 * 2. Supprime les cookies de session (academia_session, academia_token, x-tenant-id)
 *
 * Cette route est appelée :
 * - Quand l'utilisateur clique « Se déconnecter »
 * - Quand la session expire après verrouillage prolongé
 * - Depuis le SessionManagerContext (performFullLogout)
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearServerSession } from '@/lib/auth/session';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

export async function POST() {
  // ── 1. Révoquer le token côté NestJS (best-effort) ──────────────────
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('academia_token');

    if (tokenCookie?.value) {
      const base = normalizeApiUrl(
        getApiBaseUrlForRoutes().replace(/\/$/, ''),
      );
      const url = `${base}/auth/logout`;

      // Appel au backend pour ajouter le token à la table revoked_tokens
      await fetch(url, {
        method: 'POST',
        headers: bffHeaders({ Authorization: `Bearer ${tokenCookie.value}` }),
      }).catch(() => {
        // Non-critique : le token expirera naturellement
      });
    }
  } catch {
    // Non-critique : les cookies seront supprimés de toute façon
  }

  // ── 2. Supprimer les cookies de session ──────────────────────────────
  await clearServerSession();

  return NextResponse.json({ success: true });
}
