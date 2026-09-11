/**
 * ============================================================================
 * GLOBAL FETCH INTERCEPTOR — Offline-first automatique pour TOUS les fetch
 * ============================================================================
 *
 * Patche window.fetch pour intercepter automatiquement TOUS les GET /api/*
 * et les faire passer par offlineFetch (qui lit IndexedDB en offline).
 *
 * Avantage : aucun composant n'a besoin d'être modifié. Les 110+ fichiers
 * qui font `fetch('/api/...')` directs bénéficient automatiquement du
 * fallback IndexedDB.
 *
 * Comportement :
 *   - GET /api/* + store IDB connu → offlineFetch (lit IDB si offline)
 *   - GET /api/* + store IDB inconnu → fetch natif (comportement par défaut)
 *   - POST/PUT/PATCH/DELETE → fetch natif (les mutations offline passent
 *     par l'outbox via offlineMutation, pas par cet intercepteur)
 *   - URLs non /api/* (assets, images, etc.) → fetch natif
 *
 * ⭐ Important : on ne patche QUE si l'environnement est client (browser).
 *    En SSR, window.fetch n'existe pas.
 * ============================================================================
 */

import { offlineFetch, offlineMutation } from './offline-fetch';
import { deriveStoreName, getTenantIdForOffline } from './store-names';
import { isTauriEnvironment, tauriSqlFetch, tauriSqlMutation } from './tauri-sql-fetch';

let isInstalled = false;

export function installGlobalFetchInterceptor(): void {
  if (isInstalled) return;
  if (typeof window === 'undefined') return;
  if (typeof window.fetch !== 'function') return;

  // ⭐ Détecter Tauri une seule fois au montage
  const isTauri = isTauriEnvironment();
  if (isTauri) {
    console.log('[GlobalFetchInterceptor] 🖥️ Tauri environment detected — routing to SQLite');
  }

  const originalFetch = window.fetch;

  // ⭐ GUARD DE RÉENTRANCE — empêche la récursion infinie quand offlineMutation
  //    appelle fetch() qui est intercepté à nouveau par patchedFetch.
  //    Sans ce guard, les mutations POST/PUT/DELETE vers URLs à store IDB connu
  //    causent une boucle infinie : patchedFetch → offlineMutation → networkFetch
  //    → fetch (= patchedFetch) → offlineMutation → ...
  //    Le header X-Offline-Internal est détecté en début de patchedFetch et
  //    court-circuite vers originalFetch.
  const INTERNAL_HEADER = 'X-Offline-Internal';

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // ⭐ GUARD DE RÉENTRANCE — si l'appelant a posé le header interne, on bypass
    //    l'intercepteur et on appelle directement originalFetch.
    //    Cas d'usage : offlineMutation appelle networkFetch qui fait fetch()
    //    avec ce header pour éviter la récursion.
    if (init?.headers) {
      const headers = new Headers(init.headers);
      if (headers.has(INTERNAL_HEADER)) {
        // Retirer le header avant l'envoi (il ne doit pas partir vers le serveur)
        const cleanInit = { ...init, headers: undefined };
        // Recopier les headers sans le header interne
        const newHeaders = new Headers(headers);
        newHeaders.delete(INTERNAL_HEADER);
        cleanInit.headers = newHeaders;
        return originalFetch.call(window, input, cleanInit);
      }
    }

    // ⭐ Extraire l'URL
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      return originalFetch.call(window, input, init);
    }

    // ⭐ Ne pas intercepter les URLs non-API (assets, images, SW, etc.)
    if (!url.includes('/api/') && !url.startsWith('/api/')) {
      return originalFetch.call(window, input, init);
    }

    // ⭐ Ne pas intercepter les routes d'auth/sync/export (NetworkOnly)
    // ⭐ Ne pas intercepter non plus les routes dashboard BFF : ce sont des agrégations
    //    complexes qui changent à chaque requête (selon academicYearId, schoolLevelId),
    //    les cacher dans IDB n'a pas de sens business et masque les timeouts backend
    //    (l'utilisateur attend 8-12s au lieu de voir une erreur immédiate).
    //    Les routes dashboard sont déjà couvertes par le cache HTTP Next.js (s-maxage=60).
    const NEVER_INTERCEPT = [
      '/api/auth/',
      '/api/sync/',
      '/api/admin-auth/',
      '/api/portal/auth/',
      '/api/dashboard/', // ⭐ BFF agrégations — pas de cache IDB
      '/export',
      '/pdf',
      '/download',
    ];
    if (NEVER_INTERCEPT.some(pattern => url.includes(pattern))) {
      return originalFetch.call(window, input, init);
    }

    // ⭐ Résoudre le store IDB
    const storeName = deriveStoreName(url);
    if (!storeName) {
      // Pas de store IDB connu → fetch natif
      return originalFetch.call(window, input, init);
    }

    const method = (init?.method || 'GET').toUpperCase();

    // ─── GET : lecture ───
    if (method === 'GET') {
      // ⭐ TAURI : lire directement depuis SQLite
      if (isTauri) {
        try {
          const data = await tauriSqlFetch(url, storeName);
          return new Response(JSON.stringify(data), {
            status: 200,
            statusText: 'OK (Tauri SQLite)',
            headers: {
              'Content-Type': 'application/json',
              'X-Tauri-SQL': 'true',
              'X-Offline-Store': storeName,
            },
          });
        } catch (error) {
          // Si SQLite échoue, retomber sur offlineFetch (IndexedDB)
        }
      }

      // ⭐ WEB : utiliser offlineFetch (lit IDB en offline, cache en online)
      try {
        const tenantId = getTenantIdForOffline();
        const data = await offlineFetch<any>(url, storeName, {
          tenantId,
          fetchOptions: init,
        });

        const body = JSON.stringify(data);
        return new Response(body, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Offline-Fetch': 'true',
            'X-Offline-Store': storeName,
          },
        });
      } catch (error) {
        // ⭐ Si offlineFetch échoue (cache vide + offline) :
        //    Retourner une 503 explicite au lieu de retomber sur le fetch natif
        //    (qui va lui-même échouer et crasher l'app).
        if (!navigator.onLine) {
          return new Response(
            JSON.stringify({ error: 'Offline — data not in cache', offline: true }),
            {
              status: 503,
              statusText: 'Offline — data not in cache',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Empty': 'true',
              },
            },
          );
        }
        // Si on est online, retomber sur le fetch natif (pour les routes non cachées)
        return originalFetch.call(window, input, init);
      }
    }

    // ─── POST/PUT/PATCH/DELETE : mutation ───
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // ⭐ TAURI : écrire directement dans SQLite (triggers → _sync_outbox)
      if (isTauri) {
        try {
          let bodyData: any = undefined;
          if (init?.body) {
            try {
              bodyData = typeof init.body === 'string'
                ? JSON.parse(init.body)
                : init.body;
            } catch {
              bodyData = init.body;
            }
          }
          const result = await tauriSqlMutation(url, method as any, bodyData, storeName);
          const responseBody = JSON.stringify(result.data ?? { success: true, offline: true });
          return new Response(responseBody, {
            status: 200,
            statusText: result.offline ? 'OK (Tauri SQLite — queued)' : 'OK',
            headers: {
              'Content-Type': 'application/json',
              'X-Tauri-SQL': 'true',
              'X-Offline-Store': storeName,
            },
          });
        } catch (error) {
          // Si Tauri SQL échoue, retomber sur offlineMutation
        }
      }

      // ⭐ WEB : utiliser offlineMutation (IndexedDB + outbox)
      try {
        // Parse le body de la requête
        let bodyData: any = undefined;
        if (init?.body) {
          try {
            bodyData = typeof init.body === 'string'
              ? JSON.parse(init.body)
              : init.body;
          } catch {
            bodyData = init.body;
          }
        }

        const tenantId = getTenantIdForOffline();
        const result = await offlineMutation<any>(
          url,
          method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          bodyData,
          { tenantId },
        );

        // ⭐ RESTRICTION REFUSÉE (Fedapay, validation paiement, publication…) :
        //    retourner une 403 avec le message métier pour que le caller voie
        //    l'échec — on ne met PAS l'opération en file d'attente.
        if (result.error && result.restricted) {
          return new Response(
            JSON.stringify({ message: result.error, restricted: true }),
            {
              status: 403,
              statusText: 'Forbidden (offline restriction)',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Restricted': 'true',
              },
            },
          );
        }

        // Construire une Response synthétique
        const responseBody = JSON.stringify(result.data ?? { success: true, offline: result.offline });
        return new Response(responseBody, {
          status: 200,
          statusText: result.offline ? 'OK (offline)' : 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Offline-Mutation': 'true',
            'X-Offline-Store': storeName,
          },
        });
      } catch (error) {
        // Si offlineMutation échoue complètement, retomber sur le fetch natif
        // (qui va probablement échouer aussi en offline, mais au moins l'erreur
        // sera cohérente pour le caller)
        if (!navigator.onLine) {
          return new Response(
            JSON.stringify({ error: 'Offline — mutation queued in outbox', offline: true }),
            {
              status: 200, // 200 pour que le caller ne crash pas — l'outbox a l'opération
              statusText: 'OK (offline — queued)',
              headers: {
                'Content-Type': 'application/json',
                'X-Offline-Queued': 'true',
              },
            },
          );
        }
        return originalFetch.call(window, input, init);
      }
    }

    // Fallback pour toute autre méthode (HEAD, OPTIONS, etc.)
    return originalFetch.call(window, input, init);
  };

  isInstalled = true;
  console.log('[GlobalFetchInterceptor] ✅ Installed — all GET + POST/PUT/PATCH/DELETE /api/* requests now intercepted for offline');
}
