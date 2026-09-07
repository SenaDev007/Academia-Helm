/**
 * ============================================================================
 * GET CACHE — Cache client + déduplication des requêtes en vol (SWR léger)
 * ============================================================================
 *
 * ⭐ FIX PERF 2026-09-07 (« lent partout, refetch à chaque changement d'onglet ») :
 *
 * PROBLÈME MESURÉ : les modules métier (Finance, Élèves…) chargent leurs
 * données via axios/fetch bruts dans des useEffect → AUCUN cache, AUCUNE
 * déduplication :
 *   - Chaque changement d'onglet = refetch complet (réseau + BDD payés 2-3×)
 *   - Plusieurs composants montés simultanément qui appellent le MÊME endpoint
 *     (ex: /finance/student-accounts chargé par l'onglet ET la modale) →
 *     N requêtes identiques en parallèle au lieu d'1
 *   - Sur réseau mobile (Benin, 300-600ms RTT), ces redondances font passer
 *     le chargement ressenti de ~1s à plusieurs dizaines de secondes.
 *
 * SOLUTION (pattern SWR minimal, sans réécrire les modules) :
 *   - `cachedGet(url, fetcher, {ttl})` : 1 entrée par URL de GET
 *     • requête en vol → tous les appelants partagent LA MÊME promesse (dédup)
 *     • donnée fraîche (< ttl) → servie instantanément, zéro réseau
 *     • donnée expirée → refetch (optionnel : servir la donnée périmée
 *       pendant le refetch — staleWhileRevalidate)
 *   - Invalidation AUTOMATIQUE : toute mutation réussie (POST/PATCH/PUT/DELETE)
 *     via apiClient, apiFetch ou financeFetch vide le cache → les données
 *     après écriture sont toujours rechargées fraîches (cohérence garantie).
 *   - Les erreurs ne sont JAMAIS mises en cache.
 *
 * TTL par défaut 45s — cohérent avec le Cache-Control s-maxage=60 que les
 * routes BFF posent déjà (on prolonge la même stratégie d'un étage).
 *
 * ⚠️ Utilisé UNIQUEMENT pour des GET idempotents à tolérance de fraîcheur
 *    de ~1 min. Ne jamais l'utiliser pour des mutations.
 */

interface CacheEntry<T = any> {
  /** Promesse en vol (null quand la donnée est en cache) */
  promise: Promise<T> | null;
  /** Donnée mise en cache */
  data: T | null;
  /** Timestamp d'expiration (ms epoch) */
  expiresAt: number;
  /** Est-ce qu'un refetch « stale-while-revalidate » est déjà en cours */
  revalidating: boolean;
}

const cache = new Map<string, CacheEntry>();

/** TTL par défaut : 45 secondes */
export const DEFAULT_GET_CACHE_TTL = 45_000;

/**
 * Vide le cache GET (tout, ou seulement les clés commençant par `prefix`).
 * Appelé automatiquement après toute mutation réussie — peut aussi l'être
 * manuellement (ex: après réception d'un event 'finance-accounts-changed').
 */
export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/**
 * GET mis en cache avec déduplication des requêtes en vol.
 *
 * @param url    Clé de cache (l'URL complète avec query params)
 * @param doFetch Fonction qui effectue réellement la requête réseau
 * @param opts   { ttl?: ms, staleWhileRevalidate?: boolean }
 * @returns La donnée (depuis le cache si fraîche, sinon depuis le réseau)
 */
export function cachedGet<T>(
  url: string,
  doFetch: () => Promise<T>,
  opts: { ttl?: number; staleWhileRevalidate?: boolean } = {},
): Promise<T> {
  const ttl = opts.ttl ?? DEFAULT_GET_CACHE_TTL;
  const swr = opts.staleWhileRevalidate ?? true;
  const entry = cache.get(url);
  const now = Date.now();

  // 1) Requête identique déjà en vol → partager la promesse (dédup)
  if (entry?.promise) {
    return entry.promise as Promise<T>;
  }

  // 2) Donnée fraîche → réponse instantanée, zéro réseau
  if (entry && entry.expiresAt > now && entry.data !== null && entry.data !== undefined) {
    return Promise.resolve(entry.data);
  }

  // 3) Donnée périmée + stale-while-revalidate → on sert le stale et on
  //    rafraîchit en arrière-plan (l'appel suivant aura la donnée fraîche).
  //    (Un seul refetch en vol : les autres appelants retombent sur le cas 2/1.)
  if (entry && swr && entry.data !== null && entry.data !== undefined && !entry.revalidating) {
    entry.revalidating = true;
    const promise = doFetch()
      .then((data) => {
        entry.promise = null;
        entry.revalidating = false;
        entry.data = data;
        entry.expiresAt = Date.now() + ttl;
        return data;
      })
      .catch(() => {
        // Échec du revalidate → on garde le stale en cache (déjà servi),
        // le prochain appel réessaiera. La donnée périmée reste disponible.
        entry.promise = null;
        entry.revalidating = false;
        return entry.data as T;
      });
    entry.promise = promise;
    return Promise.resolve(entry.data as T);
  }

  // 4) Aucune donnée → fetch normal avec mise en cache
  const newEntry: CacheEntry<T> = {
    promise: null,
    data: null,
    expiresAt: 0,
    revalidating: false,
  };
  const promise = doFetch()
    .then((data) => {
      newEntry.promise = null;
      newEntry.data = data;
      newEntry.expiresAt = Date.now() + ttl;
      return data;
    })
    .catch((err) => {
      // ⚠️ Jamais de cache d'erreur : on purge l'entrée pour que le
      // prochain appel réessaie (au lieu de servir un échec périmé).
      if (cache.get(url) === newEntry) cache.delete(url);
      throw err;
    });
  newEntry.promise = promise;
  cache.set(url, newEntry as CacheEntry);
  return promise;
}

/** Statistiques (debug/dev — affichables en console si besoin) */
export function getApiCacheStats(): { entries: number; inFlight: number; fresh: number } {
  let inFlight = 0;
  let fresh = 0;
  const now = Date.now();
  for (const e of cache.values()) {
    if (e.promise) inFlight++;
    else if (e.expiresAt > now) fresh++;
  }
  return { entries: cache.size, inFlight, fresh };
}
