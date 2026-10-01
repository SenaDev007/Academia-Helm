/**
 * Federis Server API — Appels serveur vers l'API NestJS pour l'espace patronat.
 * Utilisé par les Server Components des pages /federis/* connectées.
 */

import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';

export interface FederisPatronatProfile {
  id: string;
  name: string;
  tenantId: string;
  orgLevel: string;
  territoryName?: string | null;
  country?: { id: string; code: string; name: string } | null;
  /** Fonction du membre dans le patronat (UI Shells) — même endpoint que le
   *  fetch client du FederisLayout : le layout partagé peut ainsi amorcer
   *  l'état sans attendre l'appel client. */
  userRole?: string | null;
  userFunction?: string | null;
  logo?: string | null;
  subscription: {
    plan: string;
    planLabel?: string;
    status: string;
    expiresAt?: string | null;
  };
}

/**
 * Charge le profil patronat associé à la session (token JWT requis).
 * Retourne null si l'appel échoue (non connecté, ou compte sans espace patronat).
 */
export async function loadFederisProfile(token: string | null): Promise<FederisPatronatProfile | null> {
  if (!token) return null;
  try {
    const base = getApiBaseUrlForRoutes();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${base}/federis/patronat/profile`, {
      method: 'GET',
      headers: bffHeaders({ Authorization: `Bearer ${token}` }),
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return (await res.json()) as FederisPatronatProfile;
  } catch (err) {
    console.warn('[loadFederisProfile] Erreur :', err);
    return null;
  }
}
