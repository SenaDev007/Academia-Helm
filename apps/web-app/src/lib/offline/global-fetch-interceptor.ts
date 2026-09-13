/**
 * ============================================================================
 * GLOBAL FETCH INTERCEPTOR — Offline-first automatique pour TOUS les fetch
 * ============================================================================
 *
 * Patche window.fetch pour intercepter automatiquement TOUS les GET /api/*
 * et les faire passer par dataService (la COUCHE D'ACCÈS AUX DONNÉES
 * UNIFIÉE — cf. data-service.ts / offline-fetch.ts).
 *
 * ⭐ Spec « Lecture hors ligne par module » §1 : « Aucun composant, page ou
 *    module ne doit appeler l'API directement » — cet intercepteur EST le
 *    point de passage obligatoire : les 110+ fichiers qui font
 *    `fetch('/api/...')` directs bénéficient automatiquement du timeout
 *    court, du cache local (response_cache) et du fallback IndexedDB,
 *    SANS modification de leur code.
 *
 * Comportement :
 *   - GET /api/* → dataService.get (timeout 5 s, cache local, fallback)
 *   - POST/PUT/PATCH/DELETE → dataService.mutate (outbox hors ligne)
 *   - URLs non /api/* (assets, navigations RSC, images…) → fetch natif
 *
 * ⭐ Important : on ne patche QUE si l'environnement est client (browser).
 *    En SSR, window.fetch n'existe pas.
 * ============================================================================
 */

import { dataService } from './data-service';
import { deriveStoreName } from './store-names';
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
    // ⭐ V18 — INPUT DE TYPE Request (axios fetch-adapter « request-mode ») :
    //    axios appelle `fetch(new Request(url, options), safeFetchOptions)` —
    //    method/headers/body sont DANS l'objet Request, pas dans init.
    //    On les extrait pour que la couche offline voie la vraie requête.
    //    (Le module complémentaire Shop/Cantine/… et les services axios passent
    //    désormais par l'adaptateur fetch — spec « toute écriture passe par la
    //    couche unifiée »).
    let requestInput: Request | null = null;
    if (typeof Request !== 'undefined' && input instanceof Request) {
      requestInput = input;
    }

    // ⭐ GUARD DE RÉENTRANCE — si l'appelant a posé le header interne (init OU
    //    Request), on bypass l'intercepteur et on appelle directement originalFetch.
    //    Cas d'usage : offlineMutation/sync-engine replay → networkFetch → fetch()
    //    avec ce header pour éviter la récursion.
    const inputHeaders: Headers | null =
      init?.headers !== undefined && init?.headers !== null
        ? new Headers(init.headers)
        : requestInput
          ? requestInput.headers
          : null;
    if (inputHeaders?.has(INTERNAL_HEADER)) {
      if (requestInput) {
        // Reconstruire la requête SANS le header interne (il ne doit pas partir
        // vers le serveur) — on ne peut pas muter un Request figé.
        const cloned = requestInput.clone();
        const cleanHeaders = new Headers(requestInput.headers);
        cleanHeaders.delete(INTERNAL_HEADER);
        const hasBody = requestInput.method !== 'GET' && requestInput.method !== 'HEAD';
        const rebuiltInit: RequestInit = {
          method: requestInput.method,
          headers: cleanHeaders,
          ...(hasBody ? { body: await cloned.text() } : {}),
          credentials: requestInput.credentials,
          ...(requestInput.signal ? { signal: requestInput.signal } : {}),
        };
        return originalFetch.call(window, requestInput.url, rebuiltInit);
      }
      // Retirer le header avant l'envoi (il ne doit pas partir vers le serveur)
      const cleanInit = { ...init, headers: undefined };
      // Recopier les headers sans le header interne
      const newHeaders = new Headers(inputHeaders);
      newHeaders.delete(INTERNAL_HEADER);
      cleanInit.headers = newHeaders;
      return originalFetch.call(window, input, cleanInit);
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

    const method = (init?.method || requestInput?.method || 'GET').toUpperCase();

    // ⭐ V18 — Si les headers/body sont portés par l'objet Request (axios
    //    fetch-adapter), les fusionner dans init pour la couche offline.
    let effectiveInit = init;
    if (requestInput && (method !== 'GET') && init?.body === undefined) {
      try {
        const bodyText = await requestInput.clone().text();
        effectiveInit = {
          ...(init ?? {}),
          method,
          body: bodyText || undefined,
        };
      } catch {
        // Corps illisible (stream déjà consommé…) — on continue avec init
      }
    } else if (requestInput && init && init.body === undefined) {
      effectiveInit = { ...init, method };
    }

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

      // ⭐ WEB : dataService.get — la couche unifiée (timeout 5 s, cache
      //    response_cache, fallback IndexedDB — cf. offline-fetch.ts)
      //    ⭐ V18 : effectiveInit inclut les headers/body extraits d'un éventuel
      //    input Request (axios fetch-adapter).
      try {
        const data = await dataService.get<any>(url, {
          storeName,
          fetchOptions: effectiveInit ?? init,
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
        // ⭐ Erreurs applicatives 4xx (le serveur a répondu et REFUSE —
        //    ex. 403 périmètre du rôle) : on re-synthétise la réponse pour
        //    l'appelant AVEC le message métier, sans re-consommer le réseau.
        //    (Les échecs réseau/timeout ne passent plus ici : dataService
        //    sert le cache local sans jamais bloquer — spec §2.3.)
        const message = (error as Error)?.message || 'Request failed';
        const status = (error as { status?: number })?.status || 502;
        return new Response(
          JSON.stringify({ message, error: message }),
          {
            status,
            statusText: 'Error (offline data layer)',
            headers: {
              'Content-Type': 'application/json',
              'X-Offline-App-Error': 'true',
            },
          },
        );
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

      // ⭐ WEB : dataService.mutate (IndexedDB + outbox hors ligne)
      try {
        // Parse le body de la requête (V18 : y compris le corps extrait d'un
        // input Request — axios fetch-adapter)
        let bodyData: any = undefined;
        if (effectiveInit?.body) {
          try {
            bodyData = typeof effectiveInit.body === 'string'
              ? JSON.parse(effectiveInit.body)
              : effectiveInit.body;
          } catch {
            bodyData = effectiveInit.body;
          }
        }

        const result = await dataService.mutate<any>(
          method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          url,
          bodyData,
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
