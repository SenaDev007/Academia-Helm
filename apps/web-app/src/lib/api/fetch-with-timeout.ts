/**
 * ============================================================================
 * FETCH WITH TIMEOUT — Utilitaire central pour tous les appels fetch
 * ============================================================================
 *
 * RÈGLE ABSOLUE : Tout appel fetch vers le backend DOIT utiliser cette
 * fonction pour garantir un timeout maximum de 8 secondes.
 *
 * Un backend en cold start sur Railway/Vercel peut mettre 30+ secondes
 * à répondre — c'est inacceptable pour l'expérience utilisateur.
 * Notre objectif : < 1 seconde de temps de réponse ressenti.
 *
 * ============================================================================
 */

/** Timeout par défaut pour les appels backend internes (ms)
 *
 * ⭐ Porté de 8s à 15s — Neon (free tier) suspend le compute après 5 min d'inactivité.
 *    Au réveil (cold start), Neon met 5-10s à répondre. Un timeout de 8s provoque
 *    des "Failed to fetch" intermittents quand un parent/promoteur se connecte
 *    après une période d'inactivité.
 *
 *    Le retry côté PrismaService gère les erreurs de connexion stale, mais le
 *    BFF doit aussi laisser le temps au backend de répondre. 15s est un bon
 *    compromis : assez long pour un cold start Neon, assez court pour ne pas
 *    bloquer l'utilisateur si le backend est vraiment down.
 */
export const DEFAULT_FETCH_TIMEOUT = 15_000;

/** Timeout pour les appels LLM externes (OpenRouter, OpenAI, Anthropic) */
export const LLM_FETCH_TIMEOUT = 15_000;

/** Timeout pour les opérations de logging/analytics (fire-and-forget) */
export const LOG_FETCH_TIMEOUT = 5_000;

/** Timeout pour les opérations de streaming (SSE, chat) */
export const STREAM_FETCH_TIMEOUT = 30_000;

/**
 * Wrapper fetch avec timeout automatique via AbortController + RETRY.
 *
 * Si `init.signal` est déjà fourni, on le respecte (l'appelant gère son propre timeout).
 * Sinon, on applique un AbortSignal.timeout(timeoutMs).
 *
 * ⭐ RETRY automatique : si le fetch échoue (timeout, Connection terminated,
 *    ECONNRESET, ou réponse 502/503/504), on réessaie une fois après 500ms.
 *    Cela gère les cold starts Neon et les recycling de connexions stale.
 *
 * @param url - URL à fetcher
 * @param init - Options fetch (même signature que fetch())
 * @param timeoutMs - Timeout en ms (défaut: 15s)
 * @returns Response
 *
 * @example
 * ```ts
 * // Utilisation simple (15s timeout par défaut + 1 retry)
 * const response = await fetchWithTimeout('/api/students');
 *
 * // Timeout personnalisé
 * const response = await fetchWithTimeout('/api/orion/query', { method: 'POST', body }, 15_000);
 *
 * // L'appelant garde le contrôle du signal
 * const controller = new AbortController();
 * const response = await fetchWithTimeout('/api/data', { signal: controller.signal });
 * ```
 */
export async function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT,
): Promise<Response> {
  // Si l'appelant a déjà fourni un signal, on le respecte (pas de retry possible)
  if (init?.signal) {
    return fetch(url, init);
  }

  // ⭐ Première tentative avec timeout
  const doFetch = async (): Promise<Response> => {
    return fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  };

  try {
    const response = await doFetch();

    // ⭐ Retry sur 502/503/504 (backend temporairement indisponible — souvent cold start)
    if ([502, 503, 504].includes(response.status)) {
      await new Promise((r) => setTimeout(r, 500));
      return doFetch();
    }

    return response;
  } catch (error: any) {
    // ⭐ Retry sur timeout / connection error (Neon cold start, socket stale)
    const isRetryable =
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError' ||
      error?.code === 'ECONNRESET' ||
      error?.code === 'ECONNREFUSED' ||
      String(error?.message || '').toLowerCase().includes('fetch failed') ||
      String(error?.message || '').toLowerCase().includes('connection terminated');

    if (isRetryable) {
      await new Promise((r) => setTimeout(r, 500));
      return doFetch();
    }

    throw error;
  }
}

/**
 * Crée un AbortController avec un timeout automatique.
 * Utile quand on a besoin de nettoyer manuellement (ex: useEffect).
 *
 * @param timeoutMs - Timeout en ms
 * @returns { controller, cleanup } — controller pour passer à fetch, cleanup à appeler dans finally/useEffect cleanup
 *
 * @example
 * ```ts
 * const { controller, cleanup } = createTimeoutController(8_000);
 * try {
 *   const response = await fetch('/api/data', { signal: controller.signal });
 * } finally {
 *   cleanup();
 * }
 * ```
 */
export function createTimeoutController(timeoutMs: number = DEFAULT_FETCH_TIMEOUT): {
  controller: AbortController;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    controller,
    cleanup: () => clearTimeout(timeoutId),
  };
}
