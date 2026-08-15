/**
 * ============================================================================
 * OFFLINE-AWARE FETCH — PASS-THROUGH MODE (offline désactivé)
 * ============================================================================
 *
 * ⛔ OFFLINE-FIRST DÉSACTIVÉ — Ces fonctions sont maintenant des pass-through
 *    simples vers fetch() natif. Aucune écriture dans IndexedDB, aucun outbox,
 *    aucun fallback hors ligne. Toutes les données vont directement à Neon.
 *
 *    Pour réactiver le mode offline, restaurer l'implémentation originale
 *    depuis l'historique git (commit avant 690e1989).
 *
 * Les fonctions conservent leur signature (offlineFetch, offlineMutation)
 * pour éviter de casser les 18 fichiers qui les importent, mais elles
 * ne font plus que déléguer vers fetch().
 * ============================================================================
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export interface OfflineFetchOptions {
  /** ID du tenant (ignoré en mode pass-through) */
  tenantId?: string;
  /** Options fetch standard */
  fetchOptions?: RequestInit;
  /** Durée de vie du cache (ignoré en mode pass-through) */
  cacheTTL?: number;
  /** Si true, ne pas utiliser le cache (ignoré — toujours network) */
  networkOnly?: boolean;
  /** Si true, ne pas écrire dans IndexedDB (ignoré — jamais d'écriture IDB) */
  skipCache?: boolean;
}

/**
 * ⛔ PASS-THROUGH — fetch natif vers l'API. Aucune écriture IndexedDB.
 */
export async function offlineFetch<T = any>(
  url: string,
  _storeName?: string,
  options: OfflineFetchOptions = {}
): Promise<T> {
  const { fetchOptions = {} } = options;

  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
      ...fetchOptions.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * ⛔ PASS-THROUGH — mutation directe vers l'API. Aucun outbox, aucune écriture IndexedDB.
 *
 * @returns { data, offline: false } — offline est toujours false car on est
 *          toujours en mode online.
 */
export async function offlineMutation<T = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: any,
  options: OfflineFetchOptions = {}
): Promise<{ data?: T; offline: boolean; error?: string }> {
  const { fetchOptions = {} } = options;

  const response = await fetch(url, {
    method,
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
      ...fetchOptions.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
    throw new Error(errorData?.message || `API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json().catch(() => undefined);
  return { data, offline: false };
}
