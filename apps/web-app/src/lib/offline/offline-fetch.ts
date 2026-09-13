/**
 * ============================================================================
 * COUCHE D'ACCÈS AUX DONNÉES UNIFIÉE (moteur) — offline-fetch
 * ============================================================================
 * ⭐ Spécification « Lecture hors ligne par module » (sept. 2026, spec
 *    mode-hors-ligne §2) : TOUTE lecture de données passe par cette couche
 *    (via dataService / l'intercepteur global — aucun composant ne doit
 *    appeler l'API directement).
 *
 * Comportement de chaque lecture GET :
 *   1. Tentative réseau AVEC TIMEOUT COURT (5 s par défaut — spec §2.2).
 *      Le Service Worker (sw.js) sert d'abord sa copie Cache API (ah-api).
 *   2. Succès → retour des données + écriture dans le cache local IndexedDB
 *      (response_cache — TOUS formats : tableaux, agrégats, objets sans id).
 *   3. Hors ligne / timeout / échec réseau → lecture du cache local, JAMAIS
 *      d'erreur bloquante (spec §2.3) : réponse exacte → réponse du même
 *      chemin (params les plus proches) → stores entités (filtres tenant).
 *   4. Les erreurs applicatives 4xx (serveur en ligne qui REFUSE : 403 rôle,
 *      404, 400 validation) restent propagées — ce ne sont pas des erreurs
 *      réseau, la lecture locale n'aurait pas de sens.
 *   5. MUTATIONS : en ligne → serveur ; hors ligne/5xx/réseau → écriture
 *      locale + outbox synchronisée automatiquement à la reconnexion
 *      (offlineMutation, spec §5).
 *
 * ⭐ V17 — response_cache : les réponses sont désormais cachées PAR URL
 *    (clé = tenant|GET|chemin+params-triés) dans un store keyPath 'cacheKey'.
 *    AVANT : les écritures dans les stores keyPath 'id' échouaient en
 *    DataError pour toute réponse SANS champ id (agrégats dashboards,
 *    settings, features…) → « le pool remplit une base que l'interface
 *    ne lit jamais » (diagnostic utilisateur exact).
 * ============================================================================
 */

import { localDb } from './local-db.service';
import { networkDetectionService } from './network-detection.service';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export interface OfflineFetchOptions {
  /** ID du tenant pour filtrer les données locales */
  tenantId?: string;
  /** Options fetch standard */
  fetchOptions?: RequestInit;
  /** Durée de vie du cache local en ms (défaut : 5 min) */
  cacheTTL?: number;
  /** Si true, ne pas utiliser le cache local (toujours fetch réseau) */
  networkOnly?: boolean;
  /** Si true, ne pas écrire dans IndexedDB après un fetch réussi */
  skipCache?: boolean;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** ⭐ V4.0 — L'INTERCEPTION VIT DANS LE SERVICE WORKER (sw.js v4) :
 *    - timeout COURT (8 s réseau, puis repli cache/IDB) : appliqué PAR LE SW
 *      sur chaque requête — la couche applicative n'a plus besoin de couper
 *      court (v3.7-v3.9 coupaient ici à 5 s → lectures ONLINE lentes servaient
 *      des données locales périmées : régression « comportements online cassés »).
 *    - les appels partent donc avec un budget GÉNÉREUX ici : soit le SW
 *      répond (réseau OU repli local) dans son propre délai, soit l'appel
 *      réellement réseau s'exécute entièrement.
 *    - le signal d'attente hors ligne est porté par l'en-tête X-Sync-Status
 *      (SW) / le résultat {offline:true} (offlineMutation) — cf. §5 de la
 *      spec d'interception réseau. */
const NETWORK_TIMEOUT_MS = 30_000;
/** Timeout des MUTATIONS via cette couche (Tauri/services directs) :
 *    volontairement LONG — une mutation ne doit JAMAIS être mise en file
 *    « au doute » alors que le serveur est en train de la traiter (risque de
 *    DOUBLON au replay). Le SW applique le même principe (15 s + file
 *    seulement sur erreur réseau avérée). */
const MUTATION_NETWORK_TIMEOUT_MS = 30_000;

/** Événement dispatché quand des données locales (cache) sont servies alors
 *  que le réseau échouait — permet aux couches supérieures (React Query via
 *  QueryProvider) de re-déclencher un rafraîchissement au retour du réseau. */
export const DATA_SERVED_FROM_CACHE_EVENT = 'ah:data-served-from-cache';

/**
 * Wrapper offline-aware pour les requêtes GET API.
 *
 * Comportement :
 * - EN LIGNE : fetch réseau → succès → cache dans IndexedDB → retourne données
 * - EN LIGNE : fetch réseau → échec → fallback IndexedDB :
 *               • si IndexedDB a des données (cache réel) → retourne données locales
 *               • si IndexedDB est VIDE (jamais sync) → REJETTE l'erreur réseau
 *                 (sinon les pages restent vides silencieusement et l'utilisateur
 *                  croit qu'il n'y a pas de données — source de bugs "page blanche")
 * - HORS LIGNE : lit depuis IndexedDB. Si vide, retourne [] (comportement normal
 *    hors ligne — on ne peut rien faire de plus, mais au moins c'est explicite
 *    grâce à isOnline=false que le user peut voir dans l'UI).
 *
 * @param url URL de l'API (ex: '/api/students')
 * @param storeName Nom du store IndexedDB pour le fallback (ex: 'students')
 * @param options Options supplémentaires
 */
export async function offlineFetch<T = any>(
  url: string,
  storeName: string,
  options: OfflineFetchOptions = {}
): Promise<T> {
  const {
    tenantId,
    fetchOptions = {},
    cacheTTL = DEFAULT_CACHE_TTL,
    networkOnly = false,
    skipCache = false,
  } = options;

  const isOnline = networkDetectionService.isConnected();

  // Mode networkOnly : toujours fetch, pas de fallback
  if (networkOnly && isOnline) {
    return await networkFetch<T>(url, fetchOptions, NETWORK_TIMEOUT_MS);
  }

  // ⭐ HORS LIGNE (v3.3.0) : on tente D'ABORD le « réseau » — le Service
  //    Worker (sw.js) sert alors la DERNIÈRE réponse en cache (Cache
  //    API, clé identitaire tenant/session) : c'est la source offline la
  //    plus fraîche ET au format exact (JSON brut de l'API, sans re-mapping
  //    IDB). Si le SW n'a pas de copie (503 X-AH-Offline) → fallback
  //    IndexedDB (response_cache puis stores entités).
  //
  // ⭐ V17 — l'ancienne double-branche (online ≠ offline) est UNIFIÉE :
  //    networkFetch (timeout 5 s) → succès → cache local ; échec réseau /
  //    timeout / hors ligne → cache local, SANS JAMAIS propager d'erreur
  //    réseau (spec §2.3) — seule une 4xx applicative remonte.
  try {
    const data = await networkFetch<T>(url, fetchOptions, NETWORK_TIMEOUT_MS);

    // Mettre en cache les données réussies (response_cache + entités)
    if (!skipCache && data !== null && data !== undefined) {
      cacheResponse(url, storeName, data, tenantId, cacheTTL).catch(() => {
        // Erreur de cache non bloquante
      });
    }

    // ⭐ V18 — WRITE-THROUGH offline : fusionner les entités LOCALES en attente
    //    de synchronisation (_isDirty) dans la réponse réseau. Pendant qu'une
    //    mutation est en file d'outbox (réseau instable, sync pas encore
    //    repassée), la liste doit refléter la création/modification locale.
    const mergedOnline = await mergePendingEntities<T>(url, storeName, data, tenantId);
    return mergedOnline;
  } catch (networkError) {
    // ⭐ Erreurs applicatives 4xx (serveur JOUE et REFUSE) : la lecture
    //    locale n'aurait pas de sens métier (403 périmètre du rôle, 404,
    //    400 validation DTO) → on propage pour que l'UI affiche l'état.
    const status = extractHttpStatus(networkError);
    if (status !== null && status >= 400 && status < 500) {
      throw networkError;
    }

    // ⭐ Réseau KO / timeout / hors ligne / 5xx → lecture locale en cascade,
    //    SANS erreur bloquante (spec §2.3) :
    //      1. response_cache — URL exacte (params triés) pour ce tenant
    //      2. response_cache — même chemin, params les plus proches
    //      3. stores entités (comportement historique : filtres tenant +
    //         année active)
    const localData = await readLocalData<T>(url, storeName, tenantId);
    if (localData !== null && localData !== undefined) {
      if (isOnline) {
        // On vient de servir du local alors qu'on croit être en ligne
        // (timeout/instabilité) → prévenir pour un rafraîchissement futur.
        try {
          window.dispatchEvent(new CustomEvent(DATA_SERVED_FROM_CACHE_EVENT, { detail: { url } }));
        } catch { /* non-bloquant */ }
      }
      // ⭐ V18 — WRITE-THROUGH offline : idem branche réseau — les entités
      //    _isDirty du store (créées/modifiées hors ligne) fusionnent dans la
      //    copie locale servie, et les _deleted en sont retirées.
      const mergedLocal = await mergePendingEntities<T>(url, storeName, localData, tenantId);
      return mergedLocal;
    }

    // Aucune copie locale → [] : état « aucune donnée sur cet appareil »
    // (légitime, badge hors ligne visible dans l'UI — jamais d'erreur).
    return [] as unknown as T;
  }
}

/**
 * Vérifie si une donnée retournée par `localFallback` contient réellement
 * des enregistrements (tableau non vide, ou objet non-null).
 * Si non → l'appelant doit propager l'erreur réseau plutôt que de retourner [].
 */
function hasRealData(data: any): boolean {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  return true;
}

// ─── V17 — response_cache : cache par URL, TOUS formats de réponse ─────────

interface ResponseCacheEntry<T = any> {
  cacheKey: string;
  tenantId: string | null;
  url: string; // chemin + params triés (sans origin — même clé app/BFF)
  data: T;
  cachedAt: number;
  expiresAt: number;
}

/** Normalise une URL en clé de cache : chemin + params triés, cache-buster
 *  `_t` retiré (miroir de apiCacheKey du sw.js — même normalisation de part
 *  et d'autre pour que SW et IDB retrouvent les MÊMES entrées).
 *  ⭐ V18 : base tolérante — si window.location est absent (tests Node,
 *  contexte worker…), on utilise une base neutre : l'URL ABSOLUE est quand
 *  même correctement décomposée, la clé reste le chemin seul. */
function normalizeUrlForCache(url: string): { path: string; full: string } {
  try {
    const base =
      typeof window !== 'undefined' && (window as any).location?.origin
        ? (window as any).location.origin
        : 'http://localhost';
    const u = new URL(url, base);
    u.searchParams.delete('_t');
    u.searchParams.sort();
    u.hash = '';
    return { path: u.pathname, full: u.pathname + (u.search || '') };
  } catch {
    const path = url.split('?')[0];
    return { path, full: url };
  }
}

/** Clé du response_cache : tenant + méthode + URL normalisée. */
function responseCacheKey(url: string, tenantId?: string): string {
  const { full } = normalizeUrlForCache(url);
  return `T:${tenantId || 'anon'}|GET|${full}`;
}

/** Écrit la réponse (tout format) dans response_cache — échec non bloquant. */
async function writeResponseCache<T>(
  url: string,
  data: T,
  tenantId: string | undefined,
  cacheTTL: number,
): Promise<void> {
  const { full } = normalizeUrlForCache(url);
  const entry: ResponseCacheEntry<T> = {
    cacheKey: responseCacheKey(url, tenantId),
    tenantId: tenantId ?? null,
    url: full,
    data,
    cachedAt: Date.now(),
    expiresAt: Date.now() + cacheTTL,
  };
  await localDb.execute('response_cache', 'put', entry);
}

/** Lecture EXACTE (même URL normalisée, même tenant). */
async function readResponseCache<T>(url: string, tenantId?: string): Promise<T | null> {
  try {
    const entry = await localDb.getByKey<ResponseCacheEntry<T>>('response_cache', responseCacheKey(url, tenantId));
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      // Entrée périmée : on la sert quand même hors ligne (mieux que rien),
      // mais on la note pour re-téléchargement — pas d'invalidation en lecture
      // (l'API a priori plus de fraîcheur, React Query rafraîchira en ligne).
    }
    return entry.data;
  } catch {
    return null;
  }
}

/** Lecture RELAXÉE : même chemin (params ≠, tenant identique), entrée la plus
 *  récente avec les params les plus proches de la demande (nombre de params
 *  en commun — priorité à la fraîcheur à égalité).
 *  Spec §2.3 : hors ligne on sert la meilleure copie locale disponible. */
async function readResponseCacheRelaxed<T>(url: string, tenantId?: string): Promise<T | null> {
  try {
    const { path, full } = normalizeUrlForCache(url);
    const wanted = new URL(full, 'http://localhost').searchParams;
    const range = IDBKeyRange.bound(path, path + '\uffff');
    const entries = await localDb.query<ResponseCacheEntry<T>>('response_cache', (store) =>
      store.index('url').getAll(range) as IDBRequest<ResponseCacheEntry<T>[]>,
    );
    const samePath = entries.filter(
      (e) => (e.url === path || e.url.startsWith(path + '?')) && (e.tenantId ?? 'anon') === (tenantId || 'anon'),
    );
    if (samePath.length === 0) return null;
    const scoreOf = (e: ResponseCacheEntry): number => {
      let score = 0;
      try {
        const got = new URL(e.url, 'http://localhost').searchParams;
        got.forEach((value, key) => {
          if (wanted.get(key) === value) score += 2; // même clé+même valeur
          else if (wanted.has(key)) score += 0; // même clé, valeur ≠ : ni bonus ni pénalité
        });
        // pénalité légère par param supplémentaire non demandé
        score -= Math.max(0, [...got.keys()].length - [...wanted.keys()].length);
      } catch { /* ignoré */ }
      return score;
    };
    samePath.sort((a, b) => {
      const d = scoreOf(b) - scoreOf(a);
      if (d !== 0) return d;
      return (b.cachedAt || 0) - (a.cachedAt || 0);
    });
    return samePath[0]?.data ?? null;
  } catch {
    return null;
  }
}

/** ⭐ V18 — WRITE-THROUGH OFFLINE : fusion des entités locales en attente.
 *
 * Contexte (spéc « création/modification hors ligne + badge en attente de
 * synchronisation ») : une mutation hors ligne écrit l'entité dans son store
 * IDB (flag _isDirty) + un événement outbox (offline-business.service). Les
 * LECTURES suivantes de la même famille d'URL doivent refléter cette écriture :
 *   - liste (tableau) : remplacer l'item de même id (modif.) / l'ajouter
 *     en fin de liste (création) ;
 *   - réponse paginée { data: [...] } / { items: [...] } : idem sur le
 *     tableau interne + recalage approximatif de `total` ;
 *   - les entités _deleted (suppression locale en attente) sont RETIRÉES.
 *
 * La fusion ne s'applique que si l'URL demandée correspond au MÊME store que
 * celui des entités dirty (ex: GET /api/students?... ↔ store 'student') —
 * aucune fuite vers d'autres familles d'entités. Échec non bloquant : en cas
 * d'erreur IDB on retourne les données d'origine.
 */
async function mergePendingEntities<T>(
  url: string,
  storeName: string,
  data: T,
  tenantId?: string
): Promise<T> {
  try {
    if (data === null || data === undefined) return data;

    // Localiser le tableau cible (réponse liste directe OU paginée)
    let arr: any[] | null = null;
    let container: { key: 'data' | 'items'; obj: any } | null = null;
    if (Array.isArray(data)) {
      arr = data as any[];
    } else if (typeof data === 'object' && Array.isArray((data as any)?.data)) {
      arr = (data as any).data;
      container = { key: 'data', obj: data as any };
    } else if (typeof data === 'object' && Array.isArray((data as any)?.items)) {
      arr = (data as any).items;
      container = { key: 'items', obj: data as any };
    }
    if (!arr) return data;

    // Entités locales du store correspondant à cette famille d'URL
    let entities: any[] = [];
    try {
      entities = await localDb.query<any>(storeName);
    } catch {
      return data; // store inexistant — rien à fusionner
    }
    if (!Array.isArray(entities) || entities.length === 0) return data;

    // ⭐ TENANT-STRICT : ne fusionner que les entités du tenant courant
    //    (même convention camelCase/snake_case que localFallback).
    const tenantOf = (item: any): string | null => {
      const v = item?.tenantId ?? item?.tenant_id;
      return v !== undefined && v !== null && v !== '' ? String(v) : null;
    };
    const relevant = entities.filter((e) => {
      if (!e || typeof e !== 'object' || !e.id) return false;
      if (tenantId && tenantOf(e) !== null && tenantOf(e) !== String(tenantId)) return false;
      // Uniquement les écritures locales non synchronisées (hors ligne)
      return e._isDirty === true;
    });
    if (relevant.length === 0) {
      // Pas de dirty — mais des _deleted peuvent devoir être retirés
      const deletedIds = new Set(
        entities
          .filter((e) => e?._deleted === true && (!tenantId || tenantOf(e) === null || tenantOf(e) === String(tenantId)))
          .map((e) => String(e.id))
      );
      if (deletedIds.size === 0) return data;
      const filtered = arr.filter((item: any) => !item?.id || !deletedIds.has(String(item.id)));
      if (filtered.length !== arr.length) {
        if (container) container.obj[container.key] = filtered;
        else return filtered as unknown as T;
      }
      return data;
    }

    const merged = [...arr];
    let appended = 0;

    for (const dirty of relevant) {
      if (dirty._deleted) {
        // Suppression locale en attente → retirer de la liste
        const idx = merged.findIndex((item: any) => item?.id && String(item.id) === String(dirty.id));
        if (idx >= 0) merged.splice(idx, 1);
        continue;
      }
      // Copie publique (sans les champs internes _) pour l'affichage
      const publicCopy: any = {};
      for (const [k, v] of Object.entries(dirty)) {
        if (k.startsWith('_')) continue;
        publicCopy[k] = v;
      }
      const idx = merged.findIndex((item: any) => item?.id && String(item.id) === String(dirty.id));
      if (idx >= 0) {
        merged[idx] = publicCopy; // modification → version locale prioritaire
      } else {
        merged.push(publicCopy); // création → visible immédiatement (badge PENDING)
        appended++;
      }
    }

    if (container) {
      container.obj[container.key] = merged;
      // Recalage approximatif des compteurs de pagination
      if (typeof container.obj?.total === 'number') {
        container.obj.total = container.obj.total + appended;
      }
      return data;
    }
    return merged as unknown as T;
  } catch (error) {
    console.warn('[OfflineFetch] mergePendingEntities failed (non-bloquant):', (error as Error).message);
    return data;
  }
}

/** ⭐ V18 — Invalide les entrées response_cache d'une FAMILLE d'URL après une
 *    mutation (en ligne réussie OU replay de sync) : la prochaine lecture ne
 *    doit pas servir une copie antérieure à l'écriture. La famille = chemin
 *    de la mutation sans les segments UUID/action finaux (ex: POST
 *    /api/students/123 → famille /api/students ; POST /api/finance/payments
 *    → famille /api/finance/payments). */
export async function invalidateResponseCacheFamily(requestUrl: string): Promise<void> {
  try {
    const { path } = normalizeUrlForCache(requestUrl);
    const segments = path.split('/').filter(Boolean);
    // Retirer les segments UUID ou verbes d'action finaux (…/{uuid}, …/{uuid}/archive, …/activate…)
    while (segments.length > 2) {
      const last = segments[segments.length - 1];
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last);
      const isAction = ['archive', 'restore', 'activate', 'close', 'promote', 'validate', 'admit', 'pre-register', 'generate-credentials', 'duplicate', 'transfer', 'refund', 'resend', 'sign', 'return'].includes(last);
      if (isUuid || isAction) segments.pop();
      else break;
    }
    const family = '/' + segments.join('/');
    if (family.length < 2) return;

    const entries = await localDb.query<{ cacheKey: string; url: string }>('response_cache');
    const stale = entries.filter((e: any) => {
      const entryPath = String(e.url || '').split('?')[0];
      return entryPath === family || entryPath.startsWith(family + '/');
    });
    for (const e of stale) {
      await localDb.execute('response_cache', 'delete', e.cacheKey).catch(() => {});
    }
    if (stale.length > 0) {
      console.log(`[OfflineFetch] response_cache invalidated for family ${family} (${stale.length} entrées)`);
    }
  } catch {
    // non-bloquant
  }
}

/** ⭐ V17 — Cascade de lecture locale (spec §2.3) :
 *    1. response_cache URL exacte → 2. response_cache même chemin (params
 *    proches) → 3. stores entités (filtres tenant + année active).
 *    Retourne null si AUCUNE donnée locale. */
async function readLocalData<T>(url: string, storeName: string, tenantId?: string): Promise<T | null> {
  // 1. réponse exacte (cache chaud — même URL, même tenant)
  const exact = await readResponseCache<T>(url, tenantId);
  if (exact !== null && exact !== undefined) return exact;

  // 2. réponse du même chemin, params les plus proches
  const relaxed = await readResponseCacheRelaxed<T>(url, tenantId);
  if (relaxed !== null && relaxed !== undefined) return relaxed;

  // 3. stores entités (données du pool / de la sync — filtrées tenant + année)
  try {
    const entityData = await localFallback<T>(storeName, tenantId);
    if (hasRealData(entityData)) return entityData;
  } catch {
    // store inexistant → pas de données entités
  }

  return null;
}

/**
 * Requête réseau standard avec headers d'authentification
 * ⭐ Ajoute le header X-Offline-Internal pour court-circuiter l'intercepteur
 *    global-fetch-interceptor.ts et éviter la récursion infinie :
 *    patchedFetch → offlineMutation → networkFetch → fetch (= patchedFetch) → ...
 * ⭐ Parse le corps d'erreur JSON pour remonter le message métier du serveur
 *    (ex: validation DTO) au lieu d'un opaque "API error: 400 Bad Request".
 * ⭐ V17 — TIMEOUT COURT (spec §2.2) : AbortController 5 s par défaut, COMBINÉ
 *    au signal d'annulation de l'appelant (React Query abort au démontage) —
 *    on n'attend JAMAIS indéfiniment (2G/3G, cold start Neon : on sert le
 *    local et l'utilisateur travaille pendant que le réseau se réveille).
 * ⭐ Headers normalisés via new Headers() — l'ancien spread {...options.headers}
 *    perdait les headers d'une instance Headers (spread d'itérateur absent).
 */
async function networkFetch<T>(url: string, options: RequestInit = {}, timeoutMs = NETWORK_TIMEOUT_MS, meta?: { syncPending?: boolean }): Promise<T> {
  const controller = new AbortController();
  const outerSignal = options.signal as AbortSignal | null | undefined;

  // ⭐ Si l'APPELANT fournit son propre signal (pool bootstrap 15 s,
  //    annulation React Query…), on respecte SON échéance — pas de timeout
  //    supplémentaire. Sinon : timeout court par défaut (spec §2.2).
  const onOuterAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }
  const timer = outerSignal ? null : setTimeout(() => controller.abort(), timeoutMs);

  // ⭐ FIX CRITIQUE 2026-09-13 (401 systémique en production) : les headers
  //    sont construits dans un objet Headers UNIQUE via .set() — qui normalise
  //    la casse et REMPLACE la valeur. Avant : un Record mixait
  //    'Authorization' (base, PascalCase) et 'authorization' (minuscule,
  //    issus de new Headers(...).forEach qui lowercase les clés) → lors du
  //    passage ultérieur à new Headers(record), les deux clés étaient
  //    COMBINÉES en « Bearer t, Bearer t » → token invalide → 401
  //    Unauthorized sur TOUTES les requêtes passant par la couche offline
  //    (l'installation module-level de l'intercepteur depuis la V19 rendait
  //    le bug systématique dès le login).
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const authHeaders: Record<string, string> = getClientAuthorizationHeader() ?? {};
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }
  headers.set('X-Offline-Internal', 'true'); // ⭐ guard de réentrance
  if (options.headers) {
    const normalized = new Headers(options.headers);
    normalized.forEach((value, key) => {
      // set() remplace la valeur existante (casse normalisée) — plus aucun
      // doublon possible, quelle que soit la casse fournie par l'appelant.
      headers.set(key, value);
    });
  }

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      let message = `API error: ${response.status} ${response.statusText}`;
      try {
        const text = await response.text();
        if (text.trim()) {
          const parsed = JSON.parse(text);
          message = parsed?.message || parsed?.error || message;
        }
      } catch { /* corps non-JSON — on garde le message HTTP */ }
      // ⭐ Statut attaché à l'erreur (le message métier remplace souvent
      //    « API error: 400 … » → le regex seul ne suffit plus)
      const err = new Error(`${message} (API error: ${response.status})`) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    // ⭐ V4.0 — Signal du Service Worker : si le SW a répondu avec une
    //    réponse FABRIQUÉE (réseau KO → mutation mise en file), il pose
    //    X-Sync-Status: pending. On le remonte à l'appelant via `meta`
    //    (offlineMutation → résultat {offline:true} → badge/état explicite).
    if (meta && response.headers && response.headers.get('X-Sync-Status') === 'pending') {
      meta.syncPending = true;
    }

    return response.json();
  } finally {
    if (timer) clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }
}

/**
 * ⭐ ANNÉE SCOLAIRE STRICTE (sept. 2026) : année active du tenant, lue depuis
 *    IndexedDB (store `local_academic_year` écrit par offline-bootstrap.service ;
 *    fallback store `academicyear` écrit par le pull sync) avec cache mémoire
 *    de 60 s pour éviter une lecture IDB à chaque requête offline.
 *
 *    En offline, on ne sert QUE les données de l'année active + les données
 *    transverses (sans academicYearId : référentiels, niveaux…). Les années
 *    antérieures — consultables EN LIGNE par le promoteur/directeur via les
 *    endpoints métier classiques — ne sont ni synchronisées (le serveur filtre
 *    le pull sur l'année active) ni servies depuis le cache local.
 */
let activeYearCache: { yearId: string | null; readAt: number } | null = null;
const ACTIVE_YEAR_TTL_MS = 60_000;

async function getActiveAcademicYearId(): Promise<string | null> {
  if (activeYearCache && Date.now() - activeYearCache.readAt < ACTIVE_YEAR_TTL_MS) {
    return activeYearCache.yearId;
  }
  let yearId: string | null = null;
  try {
    // Source 1 : store du bootstrap (local_academic_year)
    const years = await localDb.query<{ id?: string }>('local_academic_year');
    yearId = years[0]?.id ?? null;
    if (!yearId) {
      // Source 2 : store du pull sync (academicyear) — cherche isActive
      const pulled = await localDb.query<{ id?: string; isActive?: boolean; is_active?: boolean }>('academicyear');
      const active = pulled.find((y: any) => y.isActive === true || y.is_active === true);
      yearId = active?.id ?? null;
    }
  } catch {
    yearId = null;
  }
  activeYearCache = { yearId, readAt: Date.now() };
  return yearId;
}

/** Invalide le cache d'année active (ex: changement d'année/d'école). */
export function invalidateActiveYearCache(): void {
  activeYearCache = null;
}

/**
 * Lecture depuis IndexedDB avec filtrage par tenant
 * ⭐ TENANT-STRICT (sept. 2026) : le filtre accepte les DEUX conventions de
 *    colonne rencontrées selon la provenance des données :
 *    - `tenantId` (camelCase — données du pull sync, SELECT * sur colonnes
 *      Prisma historiques, et enrichissement cacheResponse/prefetch)
 *    - `tenant_id` (snake_case — 19 tables migrées @map, données du SW
 *      background push)
 *    Sans tenantId connu, on NE retourne PAS tout le store (fuite cross-tenant
 *    possible) : on retourne les items dont la colonne tenant est ABSENTE
 *    (référentiels partagés : pays, niveaux…) uniquement.
 * ⭐ ANNÉE-STRICT : les items rattachés à une année scolaire ANTÉRIEURE ne
 *    sont pas servis offline (l'année active seule + les données transverses).
 */
async function localFallback<T>(storeName: string, tenantId?: string): Promise<T> {
  try {
    const allData = await localDb.query<T>(storeName);

    // Exclure les éléments supprimés localement
    let filtered = allData.filter((item: any) => !item._deleted);

    // ⭐ TENANT-STRICT : déterminer le tenant de chaque item (camelCase OU snake_case)
    const itemTenantOf = (item: any): string | null => {
      const v = item.tenantId ?? item.tenant_id;
      return v !== undefined && v !== null && v !== '' ? String(v) : null;
    };

    if (tenantId) {
      // Item rattaché à un tenant → ne le servir QUE s'il s'agit du tenant courant
      filtered = filtered.filter(
        (item: any) => itemTenantOf(item) === null || itemTenantOf(item) === String(tenantId),
      );
    } else {
      // ⭐ Sans tenant courant connu (session non réhydratée) : ne JAMAIS servir
      //    de données rattachées à un tenant — référentiels partagés uniquement
      //    (évite toute fuite cross-tenant avant résolution de la session)
      filtered = filtered.filter((item: any) => itemTenantOf(item) === null);
    }

    // ⭐ ANNÉE-STRICT : exclure les données d'années antérieures (hors année active)
    const activeYearId = await getActiveAcademicYearId();
    if (activeYearId) {
      filtered = filtered.filter((item: any) => {
        const year = item.academicYearId ?? item.academic_year_id;
        // Sans année (référentiel/donnée transverse) → accessible
        if (year === undefined || year === null || year === '') return true;
        return String(year) === String(activeYearId);
      });
    }

    // Si les données sont un tableau, les retourner directement
    if (Array.isArray(filtered)) {
      return filtered as unknown as T;
    }

    return filtered as unknown as T;
  } catch (error) {
    console.warn(`[OfflineFetch] IndexedDB read failed for ${storeName}:`, (error as Error).message);
    // Retourner un tableau vide plutôt que de crasher
    return [] as unknown as T;
  }
}

/**
 * Cache une réponse API dans IndexedDB
 * ⭐ V17 — TROIS écritures (spec §2 : la mise à jour du local doit marcher
 *    pour TOUTES les formes de réponses) :
 *    (a) response_cache — l'entrée {cacheKey, data} : TOUJOURS (tableaux,
 *        agrégats, objets sans id — c'est la couche que la lecture relit).
 *    (b) stores entités — uniquement les TABLEAUX dont les items ont un `id`
 *        (comportement historique, alimente le filtrage tenant/année et les
 *        écritures optimistes offline ; les items sans id ne génèrent plus
 *        de DataError silencieuse — ils sont simplement sautés).
 */
async function cacheResponse<T>(
  url: string,
  storeName: string,
  data: T,
  tenantId?: string,
  cacheTTL?: number
): Promise<void> {
  // (a) response_cache — TOUS formats, clé par URL
  try {
    await writeResponseCache(url, data, tenantId, cacheTTL ?? DEFAULT_CACHE_TTL);
  } catch (error) {
    console.warn(`[OfflineFetch] response_cache write failed for ${url}:`, (error as Error).message);
  }

  // (b) stores entités — tableaux avec ids uniquement, y compris les tableaux
  //    INTERNES des réponses paginées { data: [...] } / { items: [...] }
  //    (⭐ V18 : avant, une réponse paginée /api/students ne remplissait JAMAIS
  //    le store 'student' → les écritures optimistes offline n'avaient aucune
  //    base locale et updateEntityOffline échouait « Entity not found »).
  try {
    const arrayData: any[] | null = Array.isArray(data)
      ? (data as any[])
      : typeof data === 'object' && data !== null
        ? Array.isArray((data as any)?.data)
          ? (data as any).data
          : Array.isArray((data as any)?.items)
            ? (data as any).items
            : null
        : null;
    if (arrayData) {
      const withId = arrayData.filter((item: any) => item && typeof item === 'object' && item.id !== undefined && item.id !== null);
      if (withId.length === 0) return;

      // Ajouter tenantId si absent et fourni
      const items = tenantId
        ? withId.map((item: any) => ({
            ...item,
            tenantId: item.tenantId || tenantId,
            _cachedAt: new Date().toISOString(),
          }))
        : withId.map((item: any) => ({
            ...item,
            _cachedAt: new Date().toISOString(),
          }));

      await localDb.executeBulk(storeName, 'put', items);
    }
    // Les réponses OBJETS (agrégats, settings) ne vont PLUS dans les stores
    // keyPath 'id' — response_cache (a) les couvre sans DataError.
  } catch (error) {
    // Erreur de cache non bloquante
    console.warn(`[OfflineFetch] Cache write failed for ${storeName}:`, (error as Error).message);
  }
}

/**
 * Variante pour les mutations (POST, PUT, PATCH, DELETE).
 *
 * En ligne : exécute la mutation sur le serveur.
 * Hors ligne : écrit localement dans IndexedDB + crée un événement outbox
 * pour synchronisation automatique à la reconnexion.
 *
 * ⭐ RESTRICTIONS (spec §7 + sécurité) : certaines opérations sont REFUSÉES
 *    hors ligne (paiement Fedapay, validation de paiement, publication de
 *    résultats, documents officiels, broadcast massif, suppression physique).
 *    Dans ce cas le résultat porte `restricted: true` + `error` (message)
 *    pour que l'UI affiche l'erreur AU LIEU de mettre en file.
 *
 * @returns { data, offline, error, restricted, queuedByServiceWorker } —
 *          offline=true si traitée hors ligne OU mise en file par le SW
 *          (badge « en attente de synchronisation » côté UI) ;
 *          queuedByServiceWorker=true lorsque la file appartient au SW
 *          (replay par Background Sync — propriétaire unique).
 */
export async function offlineMutation<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string; restricted?: boolean; queuedByServiceWorker?: boolean }> {
  const isOnline = networkDetectionService.isConnected();

  if (isOnline) {
    try {
      // ⭐ V4.0 — meta : si le SERVICE WORKER a intercepté la requête et a
      //    répondu avec une mutation FABRIQUÉE (réseau KO au moment du fetch
      //    alors que navigator.onLine était vrai — lie-fi), il pose
      //    X-Sync-Status: pending. On le remonte en {offline:true} pour que
      //    les appelants (hooks de mutation, UI paiement…) affichent l'état
      //    « en attente de synchronisation / validation réseau ».
      const meta: { syncPending?: boolean } = {};
      const data = await networkFetch<T>(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        ...options.fetchOptions,
      }, MUTATION_NETWORK_TIMEOUT_MS, meta);
      if (meta.syncPending) {
        // La mutation est EN FILE côté SW (outbox + Background Sync) :
        // pas d'invalidation locale ici — le SW gère la fraîcheur à la
        // reconnexion (replay + purge de la famille d'URL).
        return { data, offline: true, queuedByServiceWorker: true };
      }
      // ⭐ V18 — la mutation en ligne a modifié les données : invalider les
      //    copies response_cache de la MÊME famille d'URL pour qu'une lecture
      //    ultérieure sur réseau instable ne serve pas une copie antérieure.
      invalidateResponseCacheFamily(url).catch(() => {});
      return { data, offline: false };
    } catch (error) {
      // ⭐ Erreurs applicatives (400/401/403/404/409/422) : ne JAMAIS rejouer
      //    en local — le serveur a REFUSÉ l'écriture pour une raison métier.
      //    On propage l'erreur pour que l'UI affiche le message.
      const status = extractHttpStatus(error);
      if (status !== null && status >= 400 && status < 500 && status !== 408) {
        throw error;
      }
      // Erreur réseau / 5xx / timeout : le serveur n'a probablement pas traité
      // la requête → fallback offline (outbox) pour ne pas perdre la saisie.
      console.warn(`[OfflineMutation] Network failed for ${method} ${url}, trying offline fallback`);
      const result = await offlineMutationFallback<T>(url, method, body, options);
      return result;
    }
  }

  // Hors ligne : écrire localement + créer événement outbox
  return await offlineMutationFallback<T>(url, method, body, options);
}

/**
 * Extrait le statut HTTP d'une erreur lancée par networkFetch
 * (propriété `status` attachée, ou motif « API error: NNN » dans le message).
 */
function extractHttpStatus(error: unknown): number | null {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === 'number') return status;
  const msg = String((error as Error)?.message || '');
  const match = msg.match(/API error:\s*(\d{3})/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Fallback offline pour les mutations : écrit dans IndexedDB + outbox
 * ⭐ V18 — ÉVÉNEMENTS AVEC REQUÊTE ORIGINALE : chaque événement outbox porte
 *    désormais `metadata.request = { url, method, body }`. À la reconnexion,
 *    le sync engine REJOUE la requête HTTP d'origine vers son endpoint réel
 *    (validation DTO + effets de bord serveur — notifications, numérotation,
 *    PDF…) au lieu d'un INSERT/UPDATE SQL générique dont les colonnes ne
 *    correspondent pas au schéma réel.
 * ⭐ V18 — URLS D'ACTION (/api/{entité}/{id}/archive, /admit, /activate…) :
 *    traitées comme des MODIFICATIONS locales (merge sur l'entité existante,
 *    archive → status ARCHIVED) — avant, un POST …/{id}/archive était traité
 *    comme une CRÉATION et CORROMPAIT l'enregistrement local.
 */
async function offlineMutationFallback<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string; restricted?: boolean }> {
  try {
    const { createEntityOffline, updateEntityOffline, deleteEntityOffline } = await import('./offline-business.service');
    const tenantId = options.tenantId || getTenantIdFromSessionOrCookie();

    if (!tenantId) {
      return {
        offline: true,
        error: 'Impossible de sauvegarder hors ligne : identifiant tenant manquant.',
        restricted: true, // ⭐ informer l'utilisateur plutôt que simuler un succès
      };
    }

    // Déterminer le type d'entité et le store depuis l'URL
    const entityType = inferEntityTypeFromUrl(url);
    const urlId = inferIdFromUrl(url);
    const entityId = body?.id || urlId || generateLocalId();

    // ⭐ V18 — requête d'origine pour le replay à la reconnexion (cf. sync-engine)
    const originRequest = { url, method, body: body ?? null };

    // ⭐ V18 — détection d'une URL D'ACTION : /api/{entité}/{uuid}/{action}
    //    (archive, admit, activate, validate, close…). Le corps de ces requêtes
    //    n'est PAS l'entité (ex: {reason}) — on MERGE sur l'entité locale au
    //    lieu de la remplacer, et l'événement outbox porte l'URL d'origine
    //    pour rejouer l'action exacte.
    const pathAfterApi = url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
    const actionMatch = pathAfterApi.match(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/([a-z][a-z0-9-]*)$/i
    );
    const isActionUrl = Boolean(actionMatch && urlId && method !== 'DELETE');
    const actionName = actionMatch?.[1]?.toLowerCase() ?? '';

    // ⭐ RESTRICTIONS HORS LIGNE (branchées sept. 2026 — spec mode hors-ligne) :
    //    Fedapay, validation paiement, publication résultats, documents
    //    officiels, broadcast massif, suppression physique → REFUS avec message
    //    clair (l'opération n'est PAS mise en file d'attente).
    const { offlineRestrictionsService } = await import('./offline-restrictions.service');
    const operationType = method === 'POST' ? 'INSERT' : method === 'DELETE' ? 'DELETE' : 'UPDATE';
    // Le service travaille sur des noms de tables pluriels (payments, exam_results…)
    const tableName = `${entityType.toLowerCase()}s`;
    const check = offlineRestrictionsService.isOperationAllowedOffline(
      tableName,
      operationType as 'INSERT' | 'UPDATE' | 'DELETE',
      body ?? {},
    );
    if (!check.allowed) {
      return {
        offline: true,
        restricted: true,
        error: check.message || 'Cette action nécessite une connexion internet.',
      };
    }

    let result: any;

    if (isActionUrl) {
      // ─── URL d'action : modification locale de l'entité ciblée ───
      // archive → status ARCHIVED (cohérent avec l'UI) ; autres actions →
      // merge des champs du corps sur l'entité locale (upsert V18).
      const patch: Record<string, any> = { ...(body ?? {}) };
      if (actionName === 'archive' || actionName === 'soft-delete') {
        patch.status = 'ARCHIVED';
      }
      result = await updateEntityOffline(tenantId, entityType, entityId, patch, {
        request: originRequest,
        action: actionName,
      });
    } else if (method === 'POST') {
      result = await createEntityOffline(tenantId, entityType, { ...body, id: entityId }, {
        request: originRequest,
      });
    } else if (method === 'PUT' || method === 'PATCH') {
      result = await updateEntityOffline(tenantId, entityType, entityId, body, {
        request: originRequest,
      });
    } else if (method === 'DELETE') {
      await deleteEntityOffline(tenantId, entityType, entityId, {
        request: originRequest,
      });
      result = { id: entityId, deleted: true };
    }

    // ⭐ V18 — la copie locale de la famille d'URL est périmée (l'écriture
    //    optimiste vient de modifier les données) → invalider pour que la
    //    prochaine lecture relise la cascade et fusionne les entités dirty.
    await invalidateResponseCacheFamily(url).catch(() => {});

    return { data: result as T, offline: true };
  } catch (fallbackError) {
    console.error('[OfflineMutation] Fallback failed:', fallbackError);
    return {
      offline: true,
      error: 'Vous êtes hors ligne. Cette action sera synchronisée automatiquement à la reconnexion.',
    };
  }
}

/**
 * Infère le type d'entité SyncEntityType depuis l'URL
 */
function inferEntityTypeFromUrl(url: string): import('@/types').SyncEntityType {
  const mapping: Record<string, import('@/types').SyncEntityType> = {
    // ─── Élèves & Scolarité ───
    'students/guardians': 'GUARDIAN',
    'students': 'STUDENT',
    // ─── RH ───
    'hr/staff': 'STAFF',
    'hr/teachers': 'TEACHER',
    'hr/contracts': 'CONTRACT',
    'hr/leaves': 'LEAVE_REQUEST',
    'hr/allowances': 'STAFF_ALLOWANCE',
    'hr/overtime': 'OVERTIME_RECORD',
    'hr/attendance': 'STAFF_ATTENDANCE',
    'hr/evaluations': 'STAFF_EVALUATION',
    'hr/documents': 'STAFF_DOCUMENT',
    'teachers': 'TEACHER',
    // ─── Classes & structure ───
    'classes': 'CLASS',
    'class-students': 'CLASS_STUDENT',
    'class-subjects': 'CLASS_SUBJECT',
    'subjects': 'SUBJECT',
    'school-levels': 'SCHOOL_LEVEL',
    'academic-years': 'ACADEMIC_YEAR',
    // ─── Examens & notes ───
    'exams': 'EXAM',
    'grades': 'GRADE',
    'exam-candidates': 'EXAM_CANDIDATE',
    'exam-results': 'EXAM_RESULT',
    'exam-scores': 'EXAM_SCORE',
    'exam-sessions': 'EXAM_SESSION',
    'exam-compositions': 'EXAM_COMPOSITION',
    'exam-deliberations': 'EXAM_DELIBERATION',
    'report-cards': 'REPORT_CARD',
    'evaluations': 'EVALUATION',
    // ─── Finances ───
    'payments': 'PAYMENT',
    'invoices': 'INVOICE',
    'finance/fee-structures': 'FEE_STRUCTURE',
    'finance/transactions': 'FINANCE_TRANSACTION',
    'finance/expenses': 'EXPENSE',
    'finance/settings': 'FINANCE_SETTING',
    // ─── Pédagogie ───
    'attendance': 'ATTENDANCE',
    'absences': 'ABSENCE',
    'homeworks': 'HOMEWORK',
    'discipline': 'DISCIPLINARY_INCIDENT',
    'incidents': 'INCIDENT',
    'class-diaries': 'CLASS_DIARY',
    'lesson-plans': 'LESSON_PLAN',
    'pedagogy/teacher/documents': 'LESSON_JOURNAL',
    'pedagogy/academic-series': 'ACADEMIC_SERIES',
    'pedagogy/teacher-profiles': 'TEACHER_PROFILE',
    'pedagogy/pedagogical-materials': 'PEDAGOGICAL_MATERIAL',
    'pedagogy/assignments': 'TEACHER_CLASS_ASSIGNMENT',
    'pedagogy/teacher-class-assignments': 'TEACHER_CLASS_ASSIGNMENT',
    'daily-logs': 'HOMEWORK_ENTRY',
    // ─── Communication ───
    'messages': 'MESSAGE',
    'notifications': 'NOTIFICATION',
    'alerts': 'ALERT',
    'announcements': 'ANNOUNCEMENT',
    // ─── Paramètres / Settings ───
    'settings/identity': 'TENANT_IDENTITY_PROFILE',
    'settings/bilingual': 'SETTINGS_BILINGUAL',
    'settings/academic': 'SCHOOL_ACADEMIC_SETTING',
    'settings/communication': 'SETTINGS_COMMUNICATION',
    'settings/security': 'SECURITY_SETTINGS',
    'settings/features': 'TENANT_FEATURE',
    // ─── Academia Shop ───
    'shop/products': 'SHOP_PRODUCT',
    'shop/categories': 'SHOP_CATEGORY',
    'shop/orders': 'SHOP_ORDER',
    'shop/sales': 'SHOP_SALE',
    // ─── Helm Connect / communauté ───
    'community/channels': 'COMMUNITY_CHANNEL',
    'community/messages': 'COMMUNITY_MESSAGE',
    'community/members': 'COMMUNITY_MEMBER',
    'community/reactions': 'COMMUNITY_REACTION',
    // ─── EduCast ───
    'educast/contents': 'EDUCAST_CONTENT',
    'educast/channels': 'EDUCAST_CHANNEL',
    'educast/playlists': 'EDUCAST_PLAYLIST',
    // ─── Cantine / Transport / Infirmerie / QHSE / Bibliothèque ───
    'canteen/menus': 'CANTEEN_MENU',
    'canteen/payments': 'CANTEEN_PAYMENT',
    'canteen/subscriptions': 'CANTEEN_SUBSCRIPTION',
    'canteen/attendance': 'CANTEEN_ATTENDANCE',
    'transport/vehicles': 'VEHICLE',
    'transport/routes': 'ROUTE',
    'infirmary/visits': 'INFIRMARY_VISIT',
    'infirmary/medical-records': 'INFIRMARY_MEDICAL_RECORD',
    'qhse/audits': 'QHSE_AUDIT',
    'qhse/incidents': 'QHSE_INCIDENT',
    'library/books': 'LIBRARY_BOOK',
    'library/loans': 'LIBRARY_LOAN',
    // ─── Divers / legacy ───
    'loans': 'LOAN',
    'sessions': 'SESSION',
  };

  // Parcourir les clés de la plus longue à la plus courte pour correspondance la plus spécifique
  const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (url.toLowerCase().includes(key.toLowerCase())) {
      return mapping[key];
    }
  }

  // Fallback : extraire le premier segment après /api/ et le convertir
  const segments = url.replace(/^\/api\//, '').split('/');
  const firstSegment = segments[0]?.replace(/-/g, '_').toUpperCase();
  return (firstSegment || 'STUDENT') as import('@/types').SyncEntityType;
}

/**
 * Extrait l'ID depuis l'URL (dernier segment UUID-like)
 */
function inferIdFromUrl(url: string): string | null {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = url.match(uuidRegex);
  return match ? match[0] : null;
}

/**
 * Génère un ID local temporaire
 */
function generateLocalId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Récupère le tenantId depuis localStorage (session) ou les cookies
 * (miroir de getTenantIdForOffline de store-names.ts, sans import pour
 * éviter tout risque de cycle de dépendances)
 */
function getTenantIdFromSessionOrCookie(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed.tenantId || parsed.tenant?.id) return parsed.tenantId || parsed.tenant.id;
    }
  } catch { /* session corrompue — on tente le cookie */ }
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return null;
}
