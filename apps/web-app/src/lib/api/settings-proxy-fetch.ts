/**
 * Appels proxy Next → Nest pour /api/settings/* (évite double /api et auth cookies academia_*).
 *
 * Par défaut: pas de cache (cache: 'no-store') pour que les changements de paramètres
 * soient immédiatement visibles.
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

  // Construire les options fetch
  const fetchInit: RequestInit = {
    ...init,
    headers: { ...headers, ...init?.headers },
    cache: 'no-store', // Par défaut: pas de cache pour les paramètres (données toujours fraîches)
  };

  return fetchWithTimeout(url, fetchInit, DEFAULT_FETCH_TIMEOUT);
}
