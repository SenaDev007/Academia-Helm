/**
 * ============================================================================
 * FINANCE FETCH — Wrapper offline-aware pour le module Finance
 * ============================================================================
 *
 * ⭐ REFACTOR OFFLINE-FIRST :
 *    Avant : raw fetch() sans aucun fallback → en offline, toutes les
 *    requêtes finance échouaient → UI vide.
 *    Maintenant : pour les GET, on utilise offlineFetch qui lit IndexedDB
 *    quand le réseau est indisponible. Pour les mutations (POST/PUT/DELETE),
 *    on garde le fetch direct (les mutations offline passent par l'outbox).
 *
 *    Le storeName est dérivé du path de l'API :
 *      /api/finance/fee-structures/overrides → "feeoverride"
 *      /api/finance/fee-structures            → "feestructure"
 *      /api/finance/payments                  → "payment"
 *      /api/finance/expenses                  → "financeexpense"
 *      etc.
 * ============================================================================
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { offlineFetch } from '@/lib/offline/offline-fetch';
import { deriveStoreName, getTenantIdForOffline } from '@/lib/offline/store-names';
import { networkDetectionService } from '@/lib/offline/network-detection.service';

// ⭐ Le mapping URL → store IDB est centralisé dans lib/offline/store-names.ts
//    (function deriveStoreName). Plus de duplication locale.

export async function financeFetch<T>(
  path: string,
  options?: { method?: string; body?: any; headers?: Record<string, string> },
): Promise<T> {
  const method = options?.method ?? 'GET';

  // ⭐ Pour les GET : utiliser offlineFetch UNIQUEMENT en offline.
  //    En online, on utilise le fetch natif pour éviter la latence.
  if (method === 'GET' && !options?.body && !networkDetectionService.isConnected()) {
    const storeName = deriveStoreName(path);
    if (storeName) {
      const tenantId = getTenantIdForOffline();
      try {
        return await offlineFetch<T>(path, storeName, { tenantId });
      } catch {
        // Si offlineFetch échoue (cache vide + offline), on laisse tomber
        // et on essaie le réseau direct (qui échouera aussi, mais au moins
        // on aura essayé).
      }
    }
  }

  // ⭐ Pour les mutations (POST/PUT/DELETE) ou les GET sans store IDB :
  //    fetch direct (les mutations offline passent par l'outbox)
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
      ...options?.headers,
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && {
      body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) {
      try {
        err = JSON.parse(text) as { message?: string; error?: string };
      } catch {
        err = {};
      }
    }
    const message = err.message ?? err.error ?? res.statusText ?? 'Erreur réseau';
    throw new Error(message);
  }
  if (!text.trim()) {
    return null as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse invalide du serveur');
  }
}
