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
import { cachedGet, invalidateApiCache } from '@/lib/api/get-cache';

/** Timeout par défaut des requêtes finance (lecture ET écriture) via BFF. */
const FINANCE_TIMEOUT_MS = 30_000;

/** Est-ce une erreur « requête probablement jamais traitée par le backend » ?
 * (timeout réseau côté client AVANT envoi, connexion refusée, ou 502/503/504
 * renvoyés par la passerelle Vercel/CDN — dans ces cas un retry est SÛR). */
function isRetryableMutationError(err: any): boolean {
  const status = err?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  const name = String(err?.name || '');
  if (name === 'TypeError' && /fetch|network/i.test(String(err?.message || ''))) return true; // fetch jamais parti
  if (name === 'AbortError') return false; // timeout — le backend a PU committer
  return false;
}

// ⭐ Le mapping URL → store IDB est centralisé dans lib/offline/store-names.ts
//    (function deriveStoreName). Plus de duplication locale.

/**
 * Requête réseau réelle (timeout + gestion erreur homogène).
 * ⭐ FIX PERF 2026-09-07 : AVANT, fetch() brut SANS TIMEOUT — une écriture
 * d'encaissement pouvait pendre indéfiniment (Vercel tuait la fonction BFF
 * → 504 opaque) ou échouer au bout de la limite navigateur.
 */
async function networkRequest<T>(
  path: string,
  method: string,
  headers: Record<string, string>,
  body: any,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      ...(body !== undefined && body !== null && {
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let err: { message?: string; error?: string } = {};
      if (text.trim()) {
        try { err = JSON.parse(text) as { message?: string; error?: string }; } catch { err = {}; }
      }
      const message = err.message ?? err.error ?? res.statusText ?? 'Erreur réseau';
      const e: any = new Error(message);
      e.status = res.status;
      throw e;
    }
    if (!text.trim()) return null as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Réponse invalide du serveur');
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const te: any = new Error("Délai d'attente dépassé. Le serveur a mis trop de temps à répondre. Réessayez.");
      te.isTimeout = true;
      throw te;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function financeFetch<T>(
  path: string,
  options?: { method?: string; body?: any; headers?: Record<string, string>; timeout?: number; noCache?: boolean },
): Promise<T> {
  const method = options?.method ?? 'GET';
  const timeoutMs = options?.timeout ?? FINANCE_TIMEOUT_MS;

  // ⭐ Pour les GET : utiliser offlineFetch UNIQUEMENT en offline.
  // En online, on utilise le fetch natif pour éviter la latence.
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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getClientAuthorizationHeader(),
    ...options?.headers,
  };

  // ── GET en ligne : CACHE 45s + DÉDUP in-flight (sauf noCache) ──
  // Avant : chaque changement d'onglet du module Finance refetchait TOUT
  // (liste transactions, comptes élèves exportAll…) → latence ressentie
  // multipliée par 3-4 sur réseau mobile. Les mutations invalident le cache.
  if (method === 'GET' && !options?.noCache) {
    return cachedGet<T>(
      `finance:${path}`,
      () => networkRequest<T>(path, method, headers, options?.body, timeoutMs),
      { ttl: 45_000 },
    );
  }

  // ── Mutations : timeout + retry SÛR (passerelle/502/503/504/réseau avant envoi)
  // + invalidation du cache GET après succès. ──
  try {
    const result = await networkRequest<T>(path, method, headers, options?.body, timeoutMs);
    invalidateApiCache();
    return result;
  } catch (err: any) {
    if (isRetryableMutationError(err)) {
      await new Promise((r) => setTimeout(r, 600));
      const result = await networkRequest<T>(path, method, headers, options?.body, timeoutMs);
      invalidateApiCache();
      return result;
    }
    throw err;
  }
}
