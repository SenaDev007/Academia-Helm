/**
 * ============================================================================
 * GLOBAL FETCH INTERCEPTOR — Offline-first SEULEMENT quand hors ligne
 * ============================================================================
 *
 * ⭐ CORRECTION CRITIQUE :
 *    Avant : l'intercepteur interceptait TOUS les GET /api/* même en online,
 *    ce qui ralentissait TOUT (passage par offlineFetch + write IDB + parse
 *    + Response synthétique). Les pages mettaient >1 min à charger.
 *
 *    Maintenant : l'intercepteur ne s'active QUE quand le navigateur est
 *    hors ligne (navigator.onLine === false). En online, on utilise le
 *    fetch natif sans aucune interception → performance normale.
 *
 *    Le cache IDB est toujours peuplé par le sync engine (pull), donc
 *    quand l'utilisateur passe offline, les données sont déjà en cache
 *    et l'intercepteur peut les lire.
 *
 * Comportement :
 *   - ONLINE  : fetch natif (aucune interception, performance normale)
 *   - OFFLINE : offlineFetch (lit IndexedDB, fallback sur cache)
 * ============================================================================
 */

import { offlineFetch } from './offline-fetch';
import { deriveStoreName, getTenantIdForOffline } from './store-names';
import { networkDetectionService } from './network-detection.service';

let isInstalled = false;

export function installGlobalFetchInterceptor(): void {
  if (isInstalled) return;
  if (typeof window === 'undefined') return;
  if (typeof window.fetch !== 'function') return;

  const originalFetch = window.fetch;

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // ⭐ EN LIGNE : ne surtout pas intercepter — performance normale
    //    Le cache IDB est peuplé par le sync engine (pull), pas besoin
    //    d'intercepter les GET en online.
    if (networkDetectionService.isConnected()) {
      return originalFetch.call(window, input, init);
    }

    // ⭐ HORS LIGNE : intercepter les GET /api/* pour lire IndexedDB
    const method = (init?.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      // En offline, les mutations non-GET échouent normalement
      // (elles devraient passer par offlineMutation/outbox)
      return originalFetch.call(window, input, init);
    }

    // Extraire l'URL
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

    // Ne pas intercepter les URLs non-API
    if (!url.includes('/api/') && !url.startsWith('/api/')) {
      return originalFetch.call(window, input, init);
    }

    // Ne pas intercepter les routes d'auth/sync/export (NetworkOnly)
    const NEVER_INTERCEPT = [
      '/api/auth/', '/api/sync/', '/api/admin-auth/',
      '/api/portal/auth/', '/export', '/pdf', '/download',
    ];
    if (NEVER_INTERCEPT.some(pattern => url.includes(pattern))) {
      return originalFetch.call(window, input, init);
    }

    // Résoudre le store IDB
    const storeName = deriveStoreName(url);
    if (!storeName) {
      // Pas de store IDB connu → fetch natif (qui échouera en offline,
      // mais le caller gérera l'erreur)
      return originalFetch.call(window, input, init);
    }

    // ⭐ Utiliser offlineFetch (lit IndexedDB en offline)
    try {
      const tenantId = getTenantIdForOffline();
      const data = await offlineFetch<any>(url, storeName, { tenantId });

      // Construire une Response synthétique
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
    } catch {
      // Si offlineFetch échoue (cache vide), retourner une réponse vide
      // plutôt que de laisser le fetch natif échouer avec une erreur réseau
      // qui affiche la page offline du Service Worker.
      return new Response(JSON.stringify([]), {
        status: 200,
        statusText: 'OK (offline cache empty)',
        headers: {
          'Content-Type': 'application/json',
          'X-Offline-Fetch': 'true',
          'X-Offline-Store': storeName,
          'X-Offline-Empty': 'true',
        },
      });
    }
  };

  isInstalled = true;
  console.log('[GlobalFetchInterceptor] ✅ Installed — intercepts GET /api/* ONLY when offline');
}
