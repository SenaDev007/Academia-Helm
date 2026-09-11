/**
 * Synchronise JWT + identifiants de session PostgreSQL avec le navigateur.
 * Les cookies httpOnly ne sont pas lisibles en JS : les appels client (pedagogyFetch, sync)
 * utilisent localStorage ; la table `sessions` côté API aligne la vérité serveur.
 */

import { persistUserScope } from './user-scope';

export type PersistClientSessionInput = {
  accessToken?: string | null;
  refreshToken?: string | null;
  /** Ligne `sessions` (auth web Nest / refresh JWT) */
  serverSessionId?: string | null;
  /** Ligne `portal_sessions` (portail école / enseignant / parent) */
  portalSessionId?: string | null;
  /** Portail d'accès — conforme au document RBAC 7 dimensions */
  portalType?: string | null;
  user?: {
    id: string;
    email?: string;
    role?: string;
    tenantId?: string | null;
    [key: string]: unknown;
  };
  tenant?: { id: string; name?: string; slug?: string; [key: string]: unknown } | null;
  expiresAt?: string | null;
  /** ⭐ P4 : périmètre serveur (niveaux/pistes autorisés) — depuis le login */
  scope?: unknown;
};

// ⭐ P2 — Constantes pour le miroir du token JWT dans Cache API.
//    Le Service Worker (sw-offline.js) n'a pas accès à localStorage (les SW
//    sont isolés du DOM), mais il peut lire Cache API. On y écrit une copie
//    du token pour qu'il puisse faire le push de l'outbox en Background Sync
//    (quand l'onglet est fermé et que le réseau revient).
//
//    Ces constantes DOIVENT rester en phase avec sw-offline.js :
//    - SW_AUTH_CACHE_NAME = 'ah-auth-token'
//    - SW_AUTH_TOKEN_URL  = '/__sw_auth_token__'
const AUTH_TOKEN_CACHE_NAME = 'ah-auth-token';
const AUTH_TOKEN_CACHE_URL = '/__sw_auth_token__';

// ⭐ P2 — Flag pour éviter de réécrire le token dans Cache API à chaque appel
//    de getClientAuthorizationHeader() (qui est appelé très fréquemment).
//    On n'écrit qu'une fois par session, puis à chaque refresh.
let tokenMirrorDone = false;

/**
 * ⭐ P2 — Écrit une copie du token JWT dans Cache API pour que le Service
 *    Worker puisse l'utiliser lors d'un Background Sync (quand l'onglet est
 *    fermé). Best-effort : ne crash pas si Cache API n'est pas disponible.
 */
async function mirrorTokenToCacheApi(token: string | null | undefined): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(AUTH_TOKEN_CACHE_NAME);
    const trimmed = token?.trim();
    if (trimmed) {
      // Cache API stocke des paires Request/Response. On utilise une URL
      // factice comme clé (l'URL n'est jamais fetchée, elle sert juste de
      // clé unique dans le cache).
      const response = new Response(trimmed, {
        headers: { 'Content-Type': 'text/plain' },
      });
      await cache.put(AUTH_TOKEN_CACHE_URL, response);
    } else {
      // Pas de token → supprimer l'entrée existante (logout)
      await cache.delete(AUTH_TOKEN_CACHE_URL);
    }
  } catch (err) {
    // Non-critique — best effort. Le SW ne pourra pas faire de push en
    // background, mais l'app foreground fonctionnera normalement.
    console.warn('[Auth] Failed to mirror token to Cache API:', err);
  }
}

/**
 * ⭐ P2 — Supprime la copie du token JWT du Cache API (au logout).
 */
async function clearTokenFromCacheApi(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(AUTH_TOKEN_CACHE_NAME);
    await cache.delete(AUTH_TOKEN_CACHE_URL);
  } catch {
    // Non-critique
  }
}

/**
 * En-tête Authorization pour les fetch client → `/api/*` (proxy Next vers Nest).
 * Les cookies httpOnly ne suffisent pas si la session repose sur localStorage.
 */
export function getClientAuthorizationHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const t = localStorage.getItem('accessToken')?.trim();
  // ⭐ P2 — Fire-and-forget : miroir du token vers Cache API pour le SW.
  //    On ne le fait qu'une fois par session (flag tokenMirrorDone) pour
  //    éviter d'écrire dans Cache API à chaque appel (cette fonction est
  //    appelée très fréquemment par les hooks React).
  //    Le flag est reset à chaque logout (clearClientSessionSync) et à
  //    chaque refresh (persistClientAccessToken).
  // ⭐ OFFLINE-FIRST RÉACTIVÉ (sept. 2026) — miroir JWT vers Cache API pour le SW
  //    (utilisé par le Service Worker pour le Background Sync)
  if (t && !tokenMirrorDone) {
    tokenMirrorDone = true;
    mirrorTokenToCacheApi(t);
  }
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function persistClientAccessToken(data: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const at = data.accessToken?.trim();
  if (at) localStorage.setItem('accessToken', at);
  const rt = data.refreshToken?.trim();
  if (rt) localStorage.setItem('refreshToken', rt);
  // ⭐ P2 — Miroir du token dans Cache API pour le Service Worker
  //    (background sync quand l'onglet est fermé). On marque le flag
  //    tokenMirrorDone pour éviter que getClientAuthorizationHeader ne
  //    réécrive inutilement le même token.
  if (at) {
    // ⭐ OFFLINE-FIRST RÉACTIVÉ — miroir Cache API (Background Sync onglet fermé)
    tokenMirrorDone = true;
    mirrorTokenToCacheApi(at);
  }
}

/**
 * ⭐ P4 — persiste le scope serveur depuis la réponse de login.
 *    Accepte `data.scope` (réponse login enseignant) ou `data.user.scope`.
 */
function persistUserScopeFromLogin(data: { scope?: unknown; user?: { scope?: unknown } | null }): void {
  if (typeof window === 'undefined') return;
  const scope = (data?.scope ?? data?.user?.scope) as Record<string, unknown> | null | undefined;
  if (scope && typeof scope === 'object') {
    // ⭐ P4-bis : passe par persistUserScope → notifie les contexts montés
    //    (événement user-scope-loaded) au lieu d'écrire silencieusement.
    persistUserScope(scope as any);
  }
}

/**
 * Persiste tokens + miroir `session` (tenantId, ids PostgreSQL) pour sync offline / pas de déphasage.
 */
export function persistClientSession(data: PersistClientSessionInput): void {
  persistClientAccessToken(data);

  if (typeof window === 'undefined') return;

  // ⭐ P4 (filtre Rôles × Pistes × Niveaux) : persiste le scope serveur s'il est
  //    présent dans la réponse de login (portail enseignant / context bootstrap).
  //    La langue UI, la piste courante et les sélecteurs verrouillés en découlent.
  persistUserScopeFromLogin(data as any);

  const sid = data.serverSessionId?.trim();
  if (sid) localStorage.setItem('serverSessionId', sid);
  else localStorage.removeItem('serverSessionId');

  const pid = data.portalSessionId?.trim();
  if (pid) localStorage.setItem('portalSessionId', pid);
  else localStorage.removeItem('portalSessionId');

  const tenantId =
    data.tenant?.id ?? data.user?.tenantId ?? null;
  if (data.user && (tenantId || data.tenant)) {
    localStorage.setItem(
      'session',
      JSON.stringify({
        tenantId,
        userId: data.user.id,
        user: data.user,
        tenant: data.tenant ?? null,
        serverSessionId: sid ?? null,
        portalSessionId: pid ?? null,
        portalType: data.portalType ?? null,
        expiresAt: data.expiresAt ?? null,
        syncedAt: new Date().toISOString(),
      }),
    );
  }
}

/**
 * Positionne le flag « fresh login » dans sessionStorage.
 * Ce flag est lu par PostLoginFlowWrapper pour afficher le loading screen
 * avec progression réelle après une authentification réussie.
 * Il est automatiquement nettoyé après l'affichage du loading.
 */
export function markFreshLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('academia_fresh_login', 'true');
    // S'assurer que le flag de complétion du flow post-login est réinitialisé
    // pour que le loading screen puisse s'afficher
    localStorage.removeItem('academia_post_login_done');
    // ⭐ Clear le flag 'just_logged_out' — un login réussi annule la grace period.
    //    Sans ça, si l'utilisateur se déconnecte puis se reconnecte dans les 60s,
    //    la prochaine visite sur /login (ex: par navigation manuelle) serait bloquée
    //    en mode "no-redirect" même si la session est valide.
    sessionStorage.removeItem('academia_just_logged_out');
  } catch { /* ignore */ }
}

export function clearClientSessionSync(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('serverSessionId');
  localStorage.removeItem('portalSessionId');
  localStorage.removeItem('session');
  // ⭐ Clear LAST_ACTIVITY_KEY pour éviter qu'une session ultérieure
  // détecte une "inactivité prolongée" basée sur un timestamp stale.
  localStorage.removeItem('academia_helm_last_activity');
  // ⭐ P2 — Supprimer aussi la copie du token dans Cache API pour que le
  //    Service Worker ne puisse plus pousser l'outbox après logout.
  //    Reset du flag tokenMirrorDone pour qu'un nouveau login déclenche à
  //    nouveau le miroir.
  // ⭐ OFFLINE-FIRST RÉACTIVÉ — purge du token Cache API au logout
  tokenMirrorDone = false;
  clearTokenFromCacheApi();

  // ⭐ ANTI-BLINK LOOP : Marquer qu'on vient de se déconnecter.
  //    La page /login a un useEffect au montage qui appelle hasLocalSessionHints()
  //    et redirige vers /app si true. Problème : après logout, des données stale
  //    peuvent persister (Cache API non nettoyée car suspendue, localStorage
  //    partiellement réécrit par un service worker, etc.).
  //    Solution : on pose un timestamp en sessionStorage. Le useEffect de /login
  //    le vérifie — si < 60s, on SAUTE l'auto-redirect même si hasLocalSessionHints()
  //    retourne true. Ça empêche la boucle infinie "login → redirect → login".
  try {
    sessionStorage.setItem('academia_just_logged_out', Date.now().toString());
  } catch { /* sessionStorage peut être indisponible en mode privé */ }

  // ⭐ TENANT-STRICT (sept. 2026) : purge du cache IndexedDB de l'école sur
  //    déconnexion — les données offline ne restent PAS sur un appareil partagé.
  //    Import dynamique asynchrone (non bloquant, pas de cycle de dépendances).
  import('@/lib/offline/offline-bootstrap.service')
    .then(({ offlineBootstrapService }) => offlineBootstrapService.clearCache())
    .catch(() => { /* non-bloquant */ });
}

/**
 * ⭐ Vérifie si l'utilisateur vient de se déconnecter (≤ gracePeriodMs ms).
 *    Utilisé par /login pour EMPÊCHER l'auto-redirect vers /app qui causerait
 *    une boucle infinie si des données stale persistent en localStorage après logout.
 *
 * @param gracePeriodMs Durée en ms pendant laquelle on considère qu'on "vient" de
 *                       se déconnecter. Défaut: 60s.
 * @returns true si logout a eu lieu récemment (dans la période de grâce)
 */
export function isRecentlyLoggedOut(gracePeriodMs: number = 60000): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ts = sessionStorage.getItem('academia_just_logged_out');
    if (!ts) return false;
    const elapsed = Date.now() - parseInt(ts, 10);
    if (isNaN(elapsed)) return false;
    if (elapsed < gracePeriodMs) return true;
    // Plus de 60s → on purge le flag (la prochaine fois, pas considéré comme logout récent)
    sessionStorage.removeItem('academia_just_logged_out');
    return false;
  } catch {
    return false;
  }
}

/**
 * ⭐ Marque qu'un login vient d'avoir lieu (à appeler APRÈS un login réussi).
 *    Clear le flag 'just_logged_out' pour que la prochaine visite sur /login
 *    puisse déclencher l'auto-redirect vers /app si la session est toujours valide.
 */
export function clearRecentlyLoggedOutFlag(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('academia_just_logged_out');
  } catch { /* ignore */ }
}

/**
 * Renouvelle l’access token via le refresh stocké (en ligne uniquement).
 * Utilisé quand le JWT court a expiré mais que l’utilisateur peut rester dans l’app.
 *
 * ⭐ FIX PERF 2026-09-07 (« chargement éternel jusqu'à déconnexion/reconnexion ») :
 *    Ce fetch N'AVAIT PAS DE TIMEOUT. Quand la route /api/auth/refresh pendait
 *    (BFF lent, backend en redémarrage, réseau mobile instable), l'intercepteur
 *    axios restait bloqué avec isRefreshing=true → TOUTES les requêtes 401
 *    suivantes s'accumulaient dans failedQueue sans jamais se résoudre →
 *    l'UI affichait un loading infini que seule une déconnexion/reconnexion
 *    (rechargement complet de la page) pouvait débloquer.
 *    → Timeout de 10s via AbortSignal.timeout : le refresh échoue proprement,
 *      la file est rejetée, l'utilisateur reçoit une erreur au lieu d'un
 *      loading sans fin.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const rt = localStorage.getItem('refreshToken')?.trim();
  if (!rt) return false;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken: rt }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000), // ⭐ 10s max — plus de refresh pendant indéfiniment
    });
    if (!res.ok) return false;

    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken?.trim()) return false;

    // Update localStorage (used by hrFetch / getClientAuthorizationHeader)
    localStorage.setItem('accessToken', data.accessToken.trim());
    if (data.refreshToken?.trim()) {
      localStorage.setItem('refreshToken', data.refreshToken.trim());
    }

    // ⭐ P2 — Miroir du NOUVEAU token dans Cache API pour le SW.
    //    tryRefreshAccessToken() est appelé quand l'access token court a
    //    expiré — le SW DOIT utiliser le token frais, pas l'ancien.
    mirrorTokenToCacheApi(data.accessToken.trim());

    // Update the academia_token cookie (used by Axios / getClientToken)
    try {
      const { setClientToken } = await import('@/lib/auth/session-client');
      setClientToken(data.accessToken.trim());
    } catch {
      // Cookie update is best-effort
    }

    return true;
  } catch {
    return false;
  }
}

/** Indique si une session locale permet le mode dégradé (cache / SQLite) sans bootstrap réseau. */
export function hasLocalSessionHints(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    localStorage.getItem('refreshToken')?.trim() ||
      localStorage.getItem('session')?.trim(),
  );
}
