/**
 * Appels client vers les proxies Next.js — Module RH
 *
 * Même pattern que pedagogyFetch (Module Pédagogie) :
 *   - fetch natif (pas Axios)
 *   - même origine → /api/hr/... → BFF proxy → NestJS
 *   - Auth via localStorage.accessToken (getClientAuthorizationHeader)
 *   - credentials: 'include' pour relay cookies
 *   - Auto-refresh on 401 before giving up
 */

import { getClientAuthorizationHeader, tryRefreshAccessToken } from '@/lib/auth/client-access-token';
import { offlineFetch } from '@/lib/offline/offline-fetch';

/**
 * Mapping URL → store IDB pour le module RH.
 * ⭐ Les noms correspondent aux stores déclarés dans local-db.service.ts.
 */
function deriveHrStoreName(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.includes('/staff') || lower.includes('/hr/staff')) return 'staff';
  if (lower.includes('/teachers') || lower.includes('/teacher')) return 'teacher';
  if (lower.includes('/contracts') || lower.includes('/contract')) return 'contract';
  if (lower.includes('/leaves') || lower.includes('/leave')) return 'leaverequest';
  if (lower.includes('/payroll') || lower.includes('/salary')) return 'salaryslip';
  if (lower.includes('/attendance') || lower.includes('/staff-attendance')) return 'staffattendance';
  if (lower.includes('/evaluations') || lower.includes('/evaluation')) return 'staffevaluation';
  if (lower.includes('/documents') || lower.includes('/document')) return 'staffdocument';
  if (lower.includes('/allowances') || lower.includes('/allowance')) return 'staffallowance';
  if (lower.includes('/overtime') || lower.includes('/overtime')) return 'overtimerecord';
  if (lower.includes('/school-directors') || lower.includes('/director')) return 'schooldirectors';
  if (lower.includes('/recruitment') || lower.includes('/jobs')) return undefined; // pas de store IDB
  return undefined;
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
  const match = document.cookie.match(/(?:^|.*;\s*)x-tenant-id\s*=\s*([^;]*).*$/);
  if (match && match[1]) return decodeURIComponent(match[1]);
  return undefined;
}

export async function hrFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  },
  _isRetry = false,
): Promise<T> {
  const method = options?.method ?? 'GET';

  // ⭐ Pour les GET : utiliser offlineFetch qui lit IndexedDB en offline
  if (method === 'GET' && !options?.body) {
    const storeName = deriveHrStoreName(path);
    if (storeName) {
      const tenantId = getTenantId();
      try {
        // ⭐ Ne pas ajouter _t=Date.now() pour offlineFetch — ça casserait
        //    le cache IDB. offlineFetch gère le cache-busting lui-même.
        return await offlineFetch<T>(path, storeName, { tenantId });
      } catch {
        // Si offlineFetch échoue, on retombe sur le fetch direct
      }
    }
  }

  // Cache-busting pour les requêtes GET directes
  let fetchUrl = path;
  if (method === 'GET') {
    const separator = fetchUrl.includes('?') ? '&' : '?';
    fetchUrl = `${fetchUrl}${separator}_t=${Date.now()}`;
  }

  const res = await fetch(fetchUrl, {
    method,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...getClientAuthorizationHeader(),
      ...options?.headers,
    },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && {
      body:
        options.body instanceof FormData || typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body),
    }),
  });

  // On 401, attempt token refresh once before giving up
  if (res.status === 401 && !_isRetry) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return hrFetch<T>(path, options, true);
    }
  }

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

/**
 * Construit l'URL BFF pour le module RH.
 *
 * @example
 * hrUrl('staff', { tenantId: 'abc', status: 'ACTIVE' })
 * // → '/api/hr/staff?tenantId=abc&status=ACTIVE'
 *
 * hrUrl('leaves/requests/123/process')
 * // → '/api/hr/leaves/requests/123/process'
 *
 * hrUrl('recruitment/jobs', { tenantId: 'abc' })
 * // → '/api/hr/recruitment/jobs?tenantId=abc'
 */
export function hrUrl(
  subPath: string,
  query?: Record<string, string | undefined>,
): string {
  const trimmed = subPath.replace(/^\//, '');
  const base = trimmed ? `/api/hr/${trimmed}` : `/api/hr`;
  if (!query) return base;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
