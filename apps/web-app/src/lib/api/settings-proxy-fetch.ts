/**
 * Appels proxy Next → Nest pour /api/settings/* (évite double /api et auth cookies academia_*).
 */
import { NextRequest } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

/**
 * @param pathSuffix ex. `settings/billing` (sans slash initial) — API_BASE_URL contient déjà `/api`.
 */
export async function fetchSettingsBackend(
  request: NextRequest,
  pathSuffix: string,
  init?: RequestInit,
): Promise<Response> {
  const base = getApiBaseUrlForRoutes().replace(/\/$/, '');
  const path = pathSuffix.replace(/^\//, '');
  const url = normalizeApiUrl(`${base}/${path}`);
  const headers = await getProxyAuthHeaders(request);
  return fetch(url, {
    ...init,
    headers: { ...headers, ...init?.headers },
    cache: 'no-store',
  });
}
