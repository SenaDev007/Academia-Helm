/**
 * ============================================================================
 * PORTAL PAGE — Server Component (wrapper)
 * ============================================================================
 *
 * Refactor : la page /portal était auparavant un 'use client' de 1101 lignes
 * qui s'exécutait entièrement côté client (pas de prerendering, LCP lent).
 *
 * Nouvelle architecture :
 *   - page.tsx (CE FICHIER) : Server Component qui prefetch les écoles en SSR
 *   - PortalClient.tsx : Client Component (l'ancienne page, renommée)
 *
 * Bénéfices :
 *   - HTML prerendered avec données initiales → LCP plus rapide
 *   - SEO amélioré (les crawlers voient les écoles dans le HTML)
 *   - Hydration React Query via HydrationBoundary (pas de flash)
 *   - Cache navigateur + cache CDN Vercel (revalidate 300s)
 *
 * Note : la logique interactive (useState, useEffect, BeninMap, etc.) reste
 * dans PortalClient.tsx — aucune logique métier n'a été modifiée.
 * ============================================================================
 */

import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { Header } from '@/components/ui/header-1';
import PortalClient from './PortalClient';

// ✅ ISR — revalidate toutes les 5 minutes
// La liste des écoles change rarement, on peut la cacher côté serveur.
export const revalidate = 300;

// ✅ Autorise le prerendering statique (au lieu de force-dynamic)
export const dynamic = 'force-static';

async function prefetchSchools() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 min — doit matcher PortalClient
        gcTime: 30 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  try {
    // Prefetch les écoles côté serveur
    // L'URL doit être absolue pour fetch côté serveur
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.academiahelm.com';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout SSR

    const res = await fetch(`${apiUrl}/api/public/schools/list`, {
      signal: controller.signal,
      next: { revalidate: 300 }, // Cache 5 min
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const schools = Array.isArray(data) ? data : (data?.schools || []);
      // Pré-remplir le cache React Query côté serveur
      await queryClient.prefetchQuery({
        queryKey: ['public-schools', 'list'],
        queryFn: () => Promise.resolve(schools),
      });
    }
  } catch {
    // Erreur prefetch non bloquante — le client retry
  }

  return dehydrate(queryClient);
}

export default async function PortalPage() {
  const dehydratedState = await prefetchSchools();

  return (
    <>
      <Header />
      <HydrationBoundary state={dehydratedState}>
        <PortalClient />
      </HydrationBoundary>
    </>
  );
}
