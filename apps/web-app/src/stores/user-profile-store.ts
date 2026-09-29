/**
 * ============================================================================
 * USER PROFILE STORE — Profil self-service « Mon profil » (tous les UI)
 * ============================================================================
 *
 * Source de vérité CLIENT pour la photo de profil de l'utilisateur connecté.
 *
 * Pourquoi un store dédié : la session (cookie serveur + localStorage) est
 * figée au moment du LOGIN — après un upload de photo, les topbars/sidebars
 * de TOUS les portails doivent se rafraîchir sans reconnexion.
 *
 *   - refresh()      → GET /api/users/me/profile (BFF, credentials include)
 *   - ensureLoaded() → fetch unique au premier montage d'un composant
 *   - setAvatar(url) → mise à jour optimiste + sync localStorage `session`
 *                      + événement window 'profile-updated' (écouté par
 *                      Helm Connect / WhatsAppChat pour recharger l'avatar).
 *
 * L'avatar est une data URL (data:image/webp;base64,...) — directement
 * utilisable dans <img src>, aucune route de fichiers nécessaire.
 * ============================================================================
 */

import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Fetch authentifié vers les routes BFF du profil : Authorization Bearer
 * (localStorage accessToken, maintenu frais par l'intercepteur axios) +
 * cookies de session (credentials include). Miroir du pattern apiClient/hrFetch.
 */
export async function authedProfileFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string>) || {}),
  };
  try {
    const token = localStorage.getItem('accessToken')?.trim();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch {
    // localStorage indisponible — les cookies restent
  }
  return fetch(url, { ...init, headers, credentials: 'include' });
}

export interface UserProfileData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  tenantId: string | null;
  avatarUrl: string | null;
  /** ⭐ Photo du dossier personnel (module RH — staff_photos) : fallback
   *    lecture seule quand l'utilisateur n'a pas de photo perso. Priorité
   *    d'affichage : avatarUrl (photo perso) > hrPhotoUrl (dossier RH). */
  hrPhotoUrl?: string | null;
  twoFactorEnabled?: boolean;
}

/** Événement diffusé après tout changement de photo de profil. */
export const PROFILE_UPDATED_EVENT = 'profile-updated';

interface UserProfileStore {
  profile: UserProfileData | null;
  loading: boolean;
  error: string | null;
  fetched: boolean;
  /** Recharge le profil depuis l'API (force). */
  refresh: () => Promise<UserProfileData | null>;
  /** Charge le profil une seule fois (idempotent — pour les hooks de montage). */
  ensureLoaded: () => Promise<void>;
  /** Met à jour l'avatar localement (après upload/suppression serveur). */
  setAvatar: (url: string | null) => void;
}

/** Met à jour l'avatar dans le miroir localStorage `session` (sync offline). */
function syncSessionAvatar(avatarUrl: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('session');
    if (!raw) return;
    const session = JSON.parse(raw);
    if (session && typeof session === 'object' && session.user) {
      session.user.avatarUrl = avatarUrl ?? undefined;
      session.syncedAt = new Date().toISOString();
      localStorage.setItem('session', JSON.stringify(session));
    }
  } catch {
    // session corrompue — ignoré (le store reste la source de vérité)
  }
}

export const useUserProfileStore = create<UserProfileStore>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  fetched: false,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const response = await authedProfileFetch('/api/users/me/profile', {
        cache: 'no-store',
      });
      if (!response.ok) {
        // 401/403 → non connecté (ou session expirée) : profil indisponible
        set({ loading: false, fetched: true, error: 'unauthenticated', profile: null });
        return null;
      }
      const data = (await response.json()) as UserProfileData;
      set({ profile: data, loading: false, fetched: true, error: null });
      return data;
    } catch {
      set({ loading: false, fetched: true, error: 'network' });
      return null;
    }
  },

  ensureLoaded: async () => {
    const { fetched, loading } = get();
    if (fetched || loading) return;
    await get().refresh();
  },

  setAvatar: (url) => {
    const current = get().profile;
    if (current) {
      set({ profile: { ...current, avatarUrl: url } });
    }
    syncSessionAvatar(url);
    // ⭐ Notifie les composants qui écoutent (Helm Connect / WhatsAppChat)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { avatarUrl: url } }));
    }
  },
}));

/**
 * Hook pratique : URL de l'avatar de l'utilisateur connecté.
 * Priorité : photo perso (profil frais API) > photo du dossier RH > fallback
 * (session / props serveur). Déclenche le chargement unique au montage
 * (dans un effet, jamais pendant le rendu — évite les mises à jour d'état
 * synchrones inter-composants).
 */
export function useAvatarUrl(fallbackUrl?: string | null): string | null {
  const profile = useUserProfileStore((s) => s.profile);
  const fetched = useUserProfileStore((s) => s.fetched);
  const ensureLoaded = useUserProfileStore((s) => s.ensureLoaded);

  useEffect(() => {
    void ensureLoaded();
  }, [ensureLoaded]);

  return profile?.avatarUrl ?? profile?.hrPhotoUrl ?? fallbackUrl ?? null;
}
