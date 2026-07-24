/**
 * ============================================================================
 * USE TENANT BY SUBDOMAIN — Hook React Query partagé pour résoudre un tenant
 * ============================================================================
 *
 * AVANT : 8 composants appelaient `/api/public/schools/by-subdomain/:slug`
 * indépendamment → 8 appels backend au lieu d'1.
 *
 * MAINTENANT : 1 seul hook, cache 5 min partagé.
 * ============================================================================
 */

'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';

export interface TenantBranding {
  name: string | null;
  slug: string | null;
  logoUrl: string | null;
  city: string | null;
  phone: string | null;
  address: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  motto: string | null;
  schoolAcronym: string | null;
  schoolType: string | null;
  website: string | null;
  email: string | null;
}

async function fetchTenantBySubdomain(slug: string): Promise<TenantBranding | null> {
  if (!slug || slug.length < 2) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`/api/public/schools/by-subdomain/${encodeURIComponent(slug)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') return null;
    throw err;
  }
}

export function useTenantBySubdomain(slug: string | null | undefined) {
  return useQuery<TenantBranding | null>({
    queryKey: ['tenant-by-subdomain', slug],
    queryFn: () => fetchTenantBySubdomain(slug!),
    enabled: !!slug && slug.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export default useTenantBySubdomain;
