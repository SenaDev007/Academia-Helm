/**
 * Appels proxy Next → Nest pour /api/settings/* (évite double /api et auth cookies academia_*).
 *
 * Supporte le cache ISR via le paramètre `revalidate` :
 *   - Par défaut: pas de cache (comportement existant)
 *   - Si revalidate > 0 : utilise next: { revalidate: N } pour ISR
 */
import { NextRequest } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout, DEFAULT_FETCH_TIMEOUT } from '@/lib/api/fetch-with-timeout';

export interface FetchSettingsBackendOptions extends RequestInit {
  /** ISR revalidate interval in seconds. 0 = no cache (default). */
  revalidate?: number;
}

/**
 * @param pathSuffix ex. `settings/billing` (sans slash initial) — API_BASE_URL contient déjà `/api`.
 * @param options Extended RequestInit with optional `revalidate` for ISR caching.
 */
export async function fetchSettingsBackend(
  request: NextRequest,
  pathSuffix: string,
  options?: FetchSettingsBackendOptions,
): Promise<Response> {
  const { revalidate = 0, ...init } = options || {};
  const base = getApiBaseUrlForRoutes().replace(/\/$/, '');
  const path = pathSuffix.replace(/^\//, '');
  const search = request.nextUrl.search;
  const url = normalizeApiUrl(`${base}/${path}${search}`);
  const headers = await getProxyAuthHeaders(request);

  // Construire les options fetch avec cache ISR si revalidate > 0
  const fetchInit: RequestInit = {
    ...init,
    headers: { ...headers, ...init?.headers },
  };

  if (revalidate > 0) {
    // ISR : Next.js met en cache la réponse pendant N secondes
    (fetchInit as any).next = { revalidate };
    // Supprimer cache: 'no-store' si présent dans init
    delete (fetchInit as any).cache;
  } else {
    // Pas de cache (comportement par défaut)
    (fetchInit as any).cache = 'no-store';
  }

  return fetchWithTimeout(url, fetchInit, DEFAULT_FETCH_TIMEOUT);
}
