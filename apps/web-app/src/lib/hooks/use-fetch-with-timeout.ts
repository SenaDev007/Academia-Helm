/**
 * ============================================================================
 * USE FETCH WITH TIMEOUT — Hook React pour fetch avec timeout et cleanup
 * ============================================================================
 *
 * RÈGLE : Tout composant client qui fait un fetch() DOIT utiliser ce hook
 * pour garantir :
 *   1. Un timeout automatique (8s par défaut)
 *   2. Un AbortController qui est nettoyé au unmount du composant
 *   3. Pas de fuite mémoire ni de race condition
 *
 * ============================================================================
 */

'use client';

import { useRef, useCallback, useEffect } from 'react';

/** Timeout par défaut côté client (ms) */
const CLIENT_FETCH_TIMEOUT = 10_000;

/**
 * Hook qui fournit une fonction `fetchWithTimeout` automatiquement liée
 * au cycle de vie du composant. Tous les fetch en cours sont annulés
 * quand le composant est unmounté.
 *
 * @param defaultTimeout - Timeout par défaut en ms (défaut: 10s)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { fetchWithTimeout } = useFetchWithTimeout();
 *
 *   const loadData = async () => {
 *     const response = await fetchWithTimeout('/api/data');
 *     if (response.ok) {
 *       const data = await response.json();
 *       setData(data);
 *     }
 *   };
 *
 *   return <button onClick={loadData}>Charger</button>;
 * }
 * ```
 */
export function useFetchWithTimeout(defaultTimeout = CLIENT_FETCH_TIMEOUT) {
  // Track all active controllers so we can abort on unmount
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeControllersRef.current.forEach(ctrl => {
        if (!ctrl.signal.aborted) {
          ctrl.abort();
        }
      });
      activeControllersRef.current.clear();
    };
  }, []);

  const fetchWithTimeout = useCallback(
    async (url: string, init?: RequestInit, timeoutMs?: number): Promise<Response> => {
      const controller = new AbortController();
      activeControllersRef.current.add(controller);

      const timeout = timeoutMs ?? defaultTimeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...init,
          signal: init?.signal ?? controller.signal,
        });
        return response;
      } finally {
        clearTimeout(timeoutId);
        activeControllersRef.current.delete(controller);
      }
    },
    [defaultTimeout]
  );

  return { fetchWithTimeout };
}
