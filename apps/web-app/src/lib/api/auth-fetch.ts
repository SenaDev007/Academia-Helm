/**
 * ============================================================================
 * AUTH FETCH — fetch natif avec auto-refresh 401 (partagé)
 * ============================================================================
 *
 * ⭐ FIX 2026-09-14 « sélecteurs niveau/année du header bloqués » :
 *    Le JWT d'accès NestJS expire après 15 MINUTES (refreshToken : 7 jours).
 *    Historiquement, SEULS les appels axios (client.ts) et fetchWithAuth
 *    (settings.service) déclenchaient le refresh sur 401. Les fetch React
 *    Query « nus » des sélecteurs du header (niveaux scolaires, années
 *    scolaires) n'envoient pas d'Authorization et ne rafraîchissaient JAMAIS
 *    le token : après expiration du JWT, le BFF (qui priorise le JWT embarqué
 *    dans academia_session) recevait un 401 backend et renvoyait une liste
 *    vide « en succès » → sélecteur rouge « Aucun niveau scolaire » /
 *    « Aucune année scolaire » en boucle, SANS aucune chance de se réparer
 *    tant qu'aucun appel axios ne passait sur la page.
 *
 *    Ce wrapper applique aux fetch React Query le même pattern que
 *    fetchWithAuth : sur 401 → tryRefreshAccessToken() (single-flight,
 *    partagé avec l'intercepteur axios) → UNE relecture. Si le refresh
 *    échoue (offline, session morte) on PROPAGE l'erreur pour que React
 *    Query retrye avec son backoff — on ne redirige PAS vers /login depuis
 *    ici (un échec réseau ≠ session morte ; cette responsabilité reste à
 *    l'intercepteur axios).
 */

import { tryRefreshAccessToken } from '@/lib/auth/client-access-token';

export interface AuthFetchOptions extends RequestInit {
  /** Timeout en ms (défaut 12 000). Aligné sur le timeout SW/BFF. */
  timeoutMs?: number;
}

/**
 * fetch() avec credentials + retry 401 via refresh token.
 * - envoie `credentials: 'include'` (cookies de session BFF) ;
 * - sur 401 : rafraîchit le token (single-flight partagé) puis RETRY UNE fois ;
 * - si le retry reste 401 ou que le refresh échoue → throw Error (React Query
 *   gère alors retry/backoff/refetchInterval — jamais de « succès vide »).
 */
export async function authFetch(url: string, options: AuthFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 12_000, ...init } = options;

  const doFetch = (): Promise<Response> =>
    fetch(url, {
      ...init,
      credentials: 'include',
      signal: init.signal ?? AbortSignal.timeout(timeoutMs),
    });

  let response: Response;
  try {
    response = await doFetch();
  } catch (err) {
    // Timeout / réseau KO : propager une erreur exploitable (retry React Query)
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (response.status !== 401) return response;

  // 401 → refresh (single-flight : partagé avec axios si un refresh est
  // déjà en cours) puis UNE relecture avec les cookies fraîchiment posés
  // (la route BFF /api/auth/refresh met à jour academia_token ET
  // academia_session via setServerSession).
  const refreshed = await tryRefreshAccessToken();
  if (!refreshed) {
    throw new Error('Session expirée (refresh impossible) — reconnexion requise');
  }

  try {
    response = await doFetch();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }
  return response;
}

export default authFetch;
