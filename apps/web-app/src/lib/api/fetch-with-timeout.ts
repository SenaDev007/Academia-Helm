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

/** Timeout par défaut pour les appels backend internes (ms) */
export const DEFAULT_FETCH_TIMEOUT = 8_000;

/** Timeout pour les appels LLM externes (OpenRouter, OpenAI, Anthropic) */
export const LLM_FETCH_TIMEOUT = 15_000;

/** Timeout pour les opérations de logging/analytics (fire-and-forget) */
export const LOG_FETCH_TIMEOUT = 5_000;

/** Timeout pour les opérations de streaming (SSE, chat) */
export const STREAM_FETCH_TIMEOUT = 30_000;

/**
 * Wrapper fetch avec timeout automatique via AbortController.
 *
 * Si `init.signal` est déjà fourni, on le respecte (l'appelant gère son propre timeout).
 * Sinon, on applique un AbortSignal.timeout(timeoutMs).
 *
 * @param url - URL à fetcher
 * @param init - Options fetch (même signature que fetch())
 * @param timeoutMs - Timeout en ms (défaut: 8s)
 * @returns Response
 *
 * @example
 * ```ts
 * // Utilisation simple (8s timeout par défaut)
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
export function fetchWithTimeout(
  url: string | URL,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT,
): Promise<Response> {
  // Si l'appelant a déjà fourni un signal, on le respecte
  if (init?.signal) {
    return fetch(url, init);
  }

  // Sinon, on applique un timeout automatique
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
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
