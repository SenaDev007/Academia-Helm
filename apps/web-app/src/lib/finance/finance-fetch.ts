/**
 * Appels client vers les proxies Next — Module Finance
 * Pattern identique à pedagogyFetch (routes BFF relatives, pas d'appel direct cross-origin)
 */

import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export async function financeFetch<T>(
  path: string,
  options?: { method?: string; body?: any; headers?: Record<string, string> },
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
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
