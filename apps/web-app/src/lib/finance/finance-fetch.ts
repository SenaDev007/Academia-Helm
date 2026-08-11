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

/**
 * Mapping URL → store IDB pour le module finance.
 * ⭐ Les noms SINGULIERS correspondent aux stores déclarés dans local-db.service.ts.
 */
function deriveStoreName(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.includes('fee-structures/overrides') || lower.includes('fee-overrides')) return 'feeoverride';
  if (lower.includes('fee-structures') || lower.includes('fee-structure')) return 'feestructure';
  if (lower.includes('payments') || lower.includes('payment')) return 'payment';
  if (lower.includes('invoices') || lower.includes('invoice')) return 'invoice';
  if (lower.includes('expenses') || lower.includes('expense')) return 'financeexpense';
  if (lower.includes('transactions') || lower.includes('transaction')) return 'financetransaction';
  if (lower.includes('treasury') || lower.includes('cash-register')) return 'financetransaction';
  if (lower.includes('student-accounts') || lower.includes('student-account')) return 'studentaccount';
  if (lower.includes('fee-configurations') || lower.includes('fee-configuration')) return 'feeconfiguration';
  if (lower.includes('fee-definitions') || lower.includes('fee-definition')) return 'feedefinition';
  if (lower.includes('fee-regimes') || lower.includes('fee-regime')) return 'feeregime';
  if (lower.includes('reports/kpi') || lower.includes('reports')) return undefined; // agrégation — pas de store unique
  if (lower.includes('collection') || lower.includes('recovery')) return undefined;
  return undefined; // Par défaut, pas de fallback IDB
}

function getTenantId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const session = localStorage.getItem('session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.tenantId || parsed.tenant?.id || undefined;
    }
  } catch {}
  // Fallback : cookie
  const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return undefined;
}

export async function financeFetch<T>(
  path: string,
  options?: { method?: string; body?: any; headers?: Record<string, string> },
): Promise<T> {
  const method = options?.method ?? 'GET';

  // ⭐ Pour les GET : utiliser offlineFetch qui lit IndexedDB en offline
  if (method === 'GET' && !options?.body) {
    const storeName = deriveStoreName(path);
    if (storeName) {
      const tenantId = getTenantId();
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
