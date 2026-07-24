/**
 * ============================================================================
 * USE AUTH ME — Hook React Query partagé pour l'utilisateur connecté
 * ============================================================================
 *
 * AVANT : Plusieurs composants appelaient `/api/auth/me` indépendamment.
 *
 * MAINTENANT : 1 seul hook, cache 10 min (les infos utilisateur changent
 * rarement en cours de session).
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  portalType?: string;
  tenantId?: string;
  [key: string]: any;
}

async function fetchAuthMe(): Promise<AuthUser | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch('/api/auth/me', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      if (res.status === 401) return null; // Non connecté
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export function useAuthMe() {
  return useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: fetchAuthMe,
    staleTime: 10 * 60 * 1000, // 10 min (l'utilisateur change rarement)
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export default useAuthMe;
