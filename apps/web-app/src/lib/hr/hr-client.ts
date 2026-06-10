/**
 * Appels client vers les proxies Next.js — Module RH
 *
 * Même pattern que pedagogyFetch (Module Pédagogie) :
 *   - fetch natif (pas Axios)
 *   - même origine → /api/hr/... → BFF proxy → NestJS
 *   - Auth via localStorage.accessToken (getClientAuthorizationHeader)
 *   - credentials: 'include' pour relay cookies
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export async function hrFetch<T>(
  path: string,
  options?: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  },
): Promise<T> {
  // Cache-busting pour les requêtes GET : ajoute _t=timestamp
  // pour contourner le cache Cloudflare même si les headers anti-cache
  // ne sont pas respectés par le CDN
  let fetchUrl = path;
  const method = options?.method ?? 'GET';
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
