/**
 * ============================================================================
 * BFF FETCH HELPER — Pattern standardisé pour les routes BFF Next.js
 * ============================================================================
 *
 * RÈGLE ABSOLUE : Toute route BFF (apps/web-app/src/app/api/**) qui proxy un
 * endpoint backend DOIT utiliser bffFetch() ou bffFetchJson() au lieu de
 * fetch() direct.
 *
 * Ce helper applique automatiquement :
 *   1. Timeout 15s (configurable) via AbortController
 *   2. cache: 'no-store' (JAMAIS next: { revalidate } — voir doc PERF-GTMETRIX-CHARGEMENT.md)
 *   3. Headers BFF standards (User-Agent, Accept, Content-Type)
 *   4. Gestion d'erreur avec retour gracieux (liste vide au lieu de 504)
 *
 * Usage :
 *   import { bffFetchJson, buildCacheHeaders } from '@/lib/api/bff-fetch';
 *
 *   export async function GET() {
 *     try {
 *       const data = await bffFetchJson<any[]>('/api/backend-endpoint');
 *       return NextResponse.json(data, {
 *         headers: buildCacheHeaders(data, { minItems: 1 }),
 *       });
 *     } catch (error: any) {
 *       return NextResponse.json({ error: error.message }, { status: 500 });
 *     }
 *   }
 * ============================================================================
 */

import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '../utils/api-urls';

/** Timeout par défaut pour les appels BFF → backend (15s) */
export const BFF_TIMEOUT = 15_000;

/**
 * Effectue un fetch BFF avec timeout automatique.
 *
 * @param backendPath - Chemin backend (ex: '/public/schools/list' ou '/api/public/schools/list')
 * @param options - Options fetch + timeoutMs personnalisable
 * @returns Response
 *
 * @throws Error si timeout ou erreur réseau
 */
export async function bffFetch(
  backendPath: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = BFF_TIMEOUT, ...fetchOptions } = options;

  const API_BASE_URL = getApiBaseUrlForRoutes();
  const apiUrl = backendPath.startsWith('/api/')
    ? backendPath
    : (API_BASE_URL.endsWith('/api')
        ? `${API_BASE_URL}${backendPath.startsWith('/') ? backendPath : '/' + backendPath}`
        : `${API_BASE_URL}/api${backendPath.startsWith('/') ? backendPath : '/' + backendPath}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(normalizeApiUrl(apiUrl), {
      method: 'GET',
      ...fetchOptions,
      headers: {
        ...bffHeaders(),
        ...(fetchOptions.headers || {}),
      },
      // ⚠️ cache: 'no-store' — JAMAIS next: { revalidate }
      // Le cache Next.js Data Cache peut être empoisonné par une réponse
      // partielle (timeout backend, cold start). On utilise uniquement
      // Cache-Control HTTP qui est géré par le CDN.
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`BFF timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Effectue un fetch BFF et parse automatiquement la réponse JSON.
 *
 * @param backendPath - Chemin backend
 * @param options - Options fetch
 * @returns Données JSON parsées
 *
 * @throws Error si timeout, erreur réseau, ou réponse non-OK
 */
export async function bffFetchJson<T = any>(
  backendPath: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const response = await bffFetch(backendPath, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `Erreur HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Construit les headers Cache-Control pour une réponse BFF.
 *
 * ⭐ PERF + SÉCURITÉ (chantier GTMetrix — spéc. §7 « mise en cache HTTP
 *    appropriée sur les données peu volatiles ») :
 *
 * RÈGLE : Si la réponse est valide (au moins `minItems` items OU a un id),
 * on pose `private, max-age=45, stale-while-revalidate=60`.
 * - `private` : ces réponses sont AUTHENTIFIÉES et scopées tenant — jamais
 *   de cache CDN partagé cross-request (`public, s-maxage` exposait des
 *   données tenant à un éventuel partage edge ; Vercel bypass de toute
 *   façon les requêtes à Authorization header, mais on ne doit pas compter
 *   sur ce détail).
 * - `max-age=45` : aligné exactement sur le cache client GET 45 s
 *   (lib/api/get-cache.ts) et les staleTime React Query — une seule
 *   source de vérité de fraîcheur, cohérente offline/online (coordination
 *   chantier SW : voir docs/PERF-GTMETRIX-CHARGEMENT.md).
 * - `stale-while-revalidate=60` : navigation retour = réponse instantanée
 *   (stale servie depuis le cache navigateur) + revalidation en arrière-plan.
 * Sinon, no-cache pour forcer un re-fetch au prochain appel (évite le cache
 * empoisonné).
 *
 * @param data - Données à valider
 * @param options - { minItems: number } pour les listes (défaut: 1)
 * @returns Headers object avec Cache-Control
 */
export function buildCacheHeaders(
  data: any,
  options: { minItems?: number } = {},
): Record<string, string> {
  const { minItems = 1 } = options;

  const isValid = Array.isArray(data)
    ? data.length >= minItems
    : !!data?.id || !!data;

  if (isValid) {
    return {
      'Cache-Control': 'private, max-age=45, stale-while-revalidate=60',
    };
  }

  // Réponse invalide/incomplète → pas de cache
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };
}

/**
 * Réponse gracieuse en cas de timeout BFF.
 * Retourne une liste vide (200) au lieu de 504 — l'UI affiche "Aucune donnée".
 */
export function gracefulTimeoutResponse(entityName: string = 'données') {
  return {
    data: [],
    error: 'timeout',
    message: `Délai dépassé — impossible de charger les ${entityName}. Veuillez réessayer.`,
  };
}
