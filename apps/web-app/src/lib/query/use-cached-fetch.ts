/**
 * ============================================================================
 * USE CACHED FETCH — Hook générique pour remplacer fetch() + useEffect
 * ============================================================================
 *
 * Ce hook remplace le pattern manuel :
 *   const [data, setData] = useState([]);
 *   useEffect(() => { fetch('/api/...').then(r => r.json()).then(setData); }, []);
 *
 * Par :
 *   const { data, isLoading } = useCachedFetch(['key'], '/api/...');
 *
 * Avantages :
 *   - Cache React Query (staleTime configurable) → pas de re-fetch au remontage
 *   - keepPreviousData → pas de flash de données vides pendant le re-fetch
 *   - Loading state géré automatiquement
 *   - Réutilisable dans TOUS les modules (pas seulement Élèves)
 *
 * Pattern identique à la page portail (recherche d'école) qui charge
 * instantanément grâce à React Query.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

interface UseCachedFetchOptions {
  /** Désactiver la query (ex: si academicYearId est vide) */
  enabled?: boolean;
  /** Temps de fraîcheur en ms (défaut: 2 min) */
  staleTime?: number;
  /** Valeur par défaut si pas de données */
  defaultData?: any;
  /** Credentials pour fetch (défaut: 'include') */
  credentials?: RequestCredentials;
  /** Cache strategy (défaut: 'no-store') */
  cache?: RequestCache;
  /** Headers supplémentaires */
  headers?: Record<string, string>;
}

/**
 * Hook générique pour fetch avec cache React Query.
 *
 * Usage :
 *   const { data, isLoading } = useCachedFetch(
 *     ['enrollments', academicYearId],
 *     `/api/students/enrollments?academicYearId=${academicYearId}`,
 *     { enabled: !!academicYearId, staleTime: 2 * 60 * 1000 }
 *   );
 */
export function useCachedFetch(
  queryKey: any[],
  url: string | null,
  options: UseCachedFetchOptions = {},
) {
  const {
    enabled = true,
    staleTime = 2 * 60 * 1000, // 2 min par défaut
    defaultData,
    credentials = 'include',
    cache = 'no-store',
    headers,
  } = options;

  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!url) return defaultData;
      const res = await fetch(url, { credentials, cache, headers });
      if (!res.ok) return defaultData;
      const data = await res.json().catch(() => defaultData);
      return data;
    },
    enabled: enabled && !!url,
    staleTime,
    placeholderData: keepPreviousData,
  });
}

/**
 * Variante pour les appels POST (mutations).
 * Pas de cache — utilisé pour les actions (créer, modifier, supprimer).
 *
 * Usage :
 *   const { mutateAsync, isPending } = useCachedMutation(['create-student']);
 *   await mutateAsync({ url: '/api/students', body: { ... } });
 */
export function useCachedPost(
  queryKey: any[],
  url: string,
  options: { staleTime?: number } = {},
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: false, // Ne pas fetcher automatiquement
    staleTime: options.staleTime || 0,
  });
}
