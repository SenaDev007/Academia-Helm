/**
 * ============================================================================
 * USE PUBLIC SCHOOLS — Hook React Query partagé pour la liste des écoles
 * ============================================================================
 *
 * PROBLÈME RÉSOLU :
 * Avant, 3 composants faisaient chacun leur propre fetch /api/public/schools/list
 * avec des useEffect + useState locaux :
 *   - SchoolSearch.tsx (modal portail)
 *   - useSchoolsMap.ts (carte Bénin)
 *   - useSchoolBranding.ts (login page branding)
 * Résultat : 3 fetchs parallèles au même endpoint, 3 états indépendants,
 * 0 cache partagé. Sur /portal, ça faisait 3 appels réseau au lieu d'1.
 *
 * SOLUTION :
 * Un seul hook usePublicSchools() basé sur React Query. La première monte
 * déclenche le fetch, les autres montes réutilisent le cache (5 min).
 * Si l'utilisateur navigue entre /portal et /login, le cache persiste.
 *
 * Usage :
 *   const { schools, isLoading, error, refetch } = usePublicSchools();
 *
 * Le hook accepte un `enabled` pour lazy-load (utile pour useSchoolsMap
 * qui n'a pas besoin des écoles tant que la carte n'est pas visible).
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface PublicSchool {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  logoUrl?: string | null;
  city?: string;
  schoolType?: string;
  country?: string;
  phone?: string;
  email?: string;
  address?: string;
  slogan?: string;
  schoolAcronym?: string;
  website?: string;
  department?: string;
  // Champs optionnels retournés par /with-jobs
  jobsCount?: number;
  [key: string]: any;
}

interface UsePublicSchoolsOptions {
  /** Si false, ne déclenche pas le fetch (lazy-load). Défaut: true. */
  enabled?: boolean;
  /** Endpoint à utiliser : 'list' (défaut) ou 'with-jobs' (plus riche). */
  endpoint?: 'list' | 'with-jobs';
}

async function fetchPublicSchools(endpoint: 'list' | 'with-jobs' = 'list'): Promise<PublicSchool[]> {
  const controller = new AbortController();
  // ⚠️ Timeout 15s (matche le timeout BFF) — avant c'était 8s mais les logos
  // base64 peuvent mettre 5-10s à transiter sur connexion lente. 15s donne
  // assez de marge sans être insupportable.
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const url = endpoint === 'with-jobs'
      ? '/api/public/schools/with-jobs'
      : '/api/public/schools/list';
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    // Gestion du format timeout renvoyé par le BFF
    if (data?.error === 'timeout' || data?.error === 'backend_timeout') {
      console.warn('[usePublicSchools] BFF returned timeout');
      return [];
    }

    // Normaliser les formats possibles
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.schools)) return data.schools;
    if (Array.isArray(data?.tenants)) return data.tenants;
    console.warn('[usePublicSchools] Unexpected format:', Object.keys(data || {}));
    return [];
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.warn('[usePublicSchools] Timeout (8s)');
      return [];
    }
    throw err;
  }
}

export function usePublicSchools(options: UsePublicSchoolsOptions = {}) {
  const { enabled = true, endpoint = 'list' } = options;

  const query = useQuery<PublicSchool[]>({
    queryKey: ['public-schools', endpoint],
    queryFn: () => fetchPublicSchools(endpoint),
    enabled,
    // ⭐ 5 minutes de cache — la liste des écoles change rarement
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    // Garder les données précédentes pendant le re-fetch (évite le flash)
    placeholderData: keepPreviousData,
    // Pas de refetch au focus — la liste change rarement et le user n'a pas
    // besoin d'être interrompu par un re-fetch quand il revient sur l'onglet
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  return {
    schools: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export default usePublicSchools;
