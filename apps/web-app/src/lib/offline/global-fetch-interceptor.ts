/**
 * ============================================================================
 * GLOBAL FETCH INTERCEPTOR — Réservé à l'environnement TAURI (webview desktop)
 * ============================================================================
 *
 * ⭐ V4.0 — ARCHITECTURE « INTERCEPTION RÉSEAU PAR LE SERVICE WORKER » :
 *
 *    En NAVIGATEUR WEB (production Vercel) : cette fonction est un NO-OP.
 *    window.fetch n'est PAS patché — les composants appellent fetch() comme
 *    avant, et c'est le Service Worker (sw.js v4) qui intercepte TOUTES les
 *    requêtes /api/* entre la page et le réseau :
 *      - GET : réseau d'abord (timeout), repli cache/IndexedDB hors ligne ;
 *      - POST/PUT/PATCH/DELETE : réseau d'abord, file de mutations + réponse
 *        fabriquée avec l'en-tête X-Sync-Status: pending si le réseau échoue.
 *
 *    Historique : v3.7-v3.9 patchaient window.fetch dans le web et routaient
 *    chaque appel vers dataService/offlineFetch (couche applicative). Cette
 *    couche modifi­ait le comportement ONLINE (réponses re-sérialisées,
 *    timeouts courts sur mutations, adaptateur axios 'fetch' imposé) →
 *    approche ROLLBACKÉE. La donnée vit désormais dans le SW, aucun composant
 *    n'est modifié.
 *
 *    En TAURI (webview desktop, sans Service Worker) : on garde le patch —
 *    les requêtes /api/* y sont routées vers SQLite (tauri-sql-fetch) et les
 *    mutations vers le outbox SQLite (triggers _sync_outbox). C'est le
 *    seul environnement où l'interception applicative reste nécessaire.
 * ============================================================================
 */

import { offlineFetch, offlineMutation } from './offline-fetch';
import { deriveStoreName } from './store-names';
import { isTauriEnvironment, tauriSqlFetch, tauriSqlMutation } from './tauri-sql-fetch';

let isInstalled = false;

export function installGlobalFetchInterceptor(): void {
  if (isInstalled) return;
  if (typeof window === 'undefined') return;
  if (typeof window.fetch !== 'function') return;

  // ⭐ V4.0 — WEB : AUCUN patch de window.fetch. L'interception vit dans le
  //    Service Worker (sw.js). Ne rien faire ici préserve le comportement
  //    online d'origine (réponses intactes, headers/status réels, streams,
  //    FormData, uploads avec progression…).
  if (!isTauriEnvironment()) {
    console.log('[GlobalFetchInterceptor] ℹ️ Web — interception déléguée au Service Worker (sw.js v4)');
    return;
  }

  console.log('[GlobalFetchInterceptor] 🖥️ Tauri environment detected — routing to SQLite');
  const originalFetch = window.fetch;

  // Guard de réentrance : offlineMutation → networkFetch → fetch (re-patché)
  const INTERNAL_HEADER = 'X-Offline-Internal';

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Header interne → bypass (rejouer la requête telle quelle vers le réseau)
    const inputHeaders =
      init?.headers !== undefined && init?.headers !== null
        ? new Headers(init.headers)
        : typeof Request !== 'undefined' && input instanceof Request
          ? input.headers
          : null;
    if (inputHeaders?.has(INTERNAL_HEADER)) {
      const newHeaders = new Headers(inputHeaders);
      newHeaders.delete(INTERNAL_HEADER);
      return originalFetch.call(window, input, { ...init, headers: newHeaders });
    }

    // Extraire l'URL
    let url: string;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (typeof Request !== 'undefined' && input instanceof Request) {
      url = input.url;
    } else {
      return originalFetch.call(window, input, init);
    }

    // Ne pas intercepter les URLs non-API (assets, images, etc.)
    if (!url.includes('/api/') && !url.startsWith('/api/')) {
      return originalFetch.call(window, input, init);
    }

    // Routes interdites à l'interception offline (auth/sync/export/downloads…)
    const NEVER_INTERCEPT = [
      '/api/auth/',
      '/api/sync/',
      '/api/admin-auth/',
      '/api/portal/auth/',
      '/export',
      '/pdf',
      '/download',
    ];
    if (NEVER_INTERCEPT.some((pattern) => url.includes(pattern))) {
      return originalFetch.call(window, input, init);
    }

    const storeName = deriveStoreName(url);
    if (!storeName) {
      return originalFetch.call(window, input, init);
    }

    const method = (
      (init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')) || 'GET'
    ).toUpperCase();

    // ─── GET : lecture depuis SQLite ───
    if (method === 'GET') {
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
      } catch {
        // SQLite indisponible → fallback IndexedDB (offlineFetch)
        try {
          const data = await offlineFetch<any>(url, storeName, { fetchOptions: init });
          return new Response(JSON.stringify(data), {
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json', 'X-Offline-Fetch': 'true' },
          });
        } catch {
          return originalFetch.call(window, input, init);
        }
      }
    }

    // ─── POST/PUT/PATCH/DELETE : écriture SQLite + outbox ───
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      try {
        let bodyData: any = undefined;
        if (init?.body) {
          try {
            bodyData = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
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
            'X-Sync-Status': result.offline ? 'pending' : 'synced',
          },
        });
      } catch {
        // SQLite KO → outbox IndexedDB applicatif (Tauri sans SW)
        try {
          const result = await offlineMutation<any>(method as 'POST' | 'PUT' | 'PATCH' | 'DELETE', url, bodyDataSafe(init));
          const responseBody = JSON.stringify(result.data ?? { success: true, offline: result.offline });
          return new Response(responseBody, {
            status: 200,
            statusText: result.offline ? 'OK (offline)' : 'OK',
            headers: {
              'Content-Type': 'application/json',
              'X-Sync-Status': result.offline ? 'pending' : 'synced',
            },
          });
        } catch {
          return originalFetch.call(window, input, init);
        }
      }
    }

    // Autres méthodes (HEAD, OPTIONS…) → fetch natif
    return originalFetch.call(window, input, init);
  };

  isInstalled = true;
}

/** Extraction sûre du corps JSON d'un RequestInit (Tauri uniquement). */
function bodyDataSafe(init?: RequestInit): any {
  if (!init?.body) return undefined;
  try {
    return typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
  } catch {
    return init.body;
  }
}
