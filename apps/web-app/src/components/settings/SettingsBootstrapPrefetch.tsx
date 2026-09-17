'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSession } from '@/contexts/AppSessionContext';
import { settingsKeys } from '@/lib/query/settings-keys';
import { fetchSettingsBootstrapCore } from '@/lib/query/fetch-settings-bootstrap';
import { hydrateAcademicYearsFromBootstrap } from '@/lib/query/academic-years-fetch';

const BOOTSTRAP_STALE_MS = 2 * 60 * 1000;

/** ⭐ FIX PERFORMANCE CONCURRENCE — rôles qui n'ont JAMAIS accès à la page
 *    Paramètres : inutile de précharger les 23 requêtes du bundle settings.
 *    AVANT : 20 enseignants connectés = 20 × 23 = 460 requêtes inutiles en
 *    rafale à chaque login (le principal amplificateur de charge au login).
 *    Les rôles admin/gestion inconnus continuent de précharger (liste noire,
 *    pas liste blanche — aucun risque de régression pour un rôle admin rare).
 */
const ROLES_WITHOUT_SETTINGS: ReadonlySet<string> = new Set([
  'TEACHER',
  'ENSEIGNANT',
  'TEACHER_RESP',
  'PARENT',
  'GUARDIAN',
  'STUDENT',
  'ELEVE',
]);

/**
 * Précharge les données Paramètres « core » dès que le tenant effectif est
 * connu (en parallèle du splash post-login).
 *
 * ⭐ PERF (chantier GTMetrix — spéc. §7) : AVANT, ce prefetch déclenchait
 * 23 GET /api/settings/* à CHAQUE montage /app/* (history, invoices, users,
 * roles, permissions, plans, billing… — utiles seulement sur la page
 * Paramètres). Désormais : 5 appels max (general, features, academic-years
 * + active, identity, bilingual), et l'hydratation des années scolaires
 * reste préservée (consommée par AcademicYearProvider).
 *
 * Aligné sur la page Paramètres : `tenant_id` en query pour PLATFORM_OWNER.
 */
export function SettingsBootstrapPrefetch() {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const queryClient = useQueryClient();
  const urlTenantId = searchParams.get('tenant_id');
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';
  // ⭐ FIX PERF — enseignants/parents/élèves : pas de prefetch settings (23 requêtes inutiles)
  const roleNeedsSettings = !ROLES_WITHOUT_SETTINGS.has(String(user?.role || '').toUpperCase());
  const effectiveTenantId = useMemo(
    () => ((isPlatformOwner || !tenant?.id) ? urlTenantId || tenant?.id : tenant?.id) ?? undefined,
    [isPlatformOwner, tenant?.id, urlTenantId],
  );

  useEffect(() => {
    if (!effectiveTenantId || !roleNeedsSettings) return;
    /** ⭐ Task 73 (2026-09-17 — lenteurs UI admin) : le bundle Paramètres (≈ 23
     *  requêtes : general, security, orion, atlas, billing, users, roles…) est
     *  un PRÉFETCH pour une page que l'utilisateur ne visitera peut-être pas
     *  tout de suite. AVANT : délai 80 ms → la rafale partait PENDANT le
     *  chargement initial et concurrençait les requêtes critiques (année
     *  scolaire, sélecteur de niveau, KPI dashboards) — visible surtout sur
     *  les connexions écoles lentes. APRÈS : différé à l'idle navigateur
     *  (min. 8 s) — l'UI est déjà interactive, le préchauffage se fait discret.
     *  NB : AcademicYearContext fait ses PROPRES requêtes au montage (2 appels
     *  académiques) — il n'attendait de toute façon pas ce préfetch.
     */
    const run = () => {
      void queryClient
        .prefetchQuery({
          queryKey: settingsKeys.bootstrapCore(effectiveTenantId),
          queryFn: () => fetchSettingsBootstrapCore(effectiveTenantId),
          staleTime: BOOTSTRAP_STALE_MS,
        })
        .then(() => {
          const data = queryClient.getQueryData<{ academicYearsResult?: unknown }>(
            settingsKeys.bootstrapCore(effectiveTenantId),
          );
          if (data?.academicYearsResult) {
            hydrateAcademicYearsFromBootstrap(
              queryClient,
              effectiveTenantId,
              data as Parameters<typeof hydrateAcademicYearsFromBootstrap>[2],
            );
          }
        });
    };
    const t = window.setTimeout(() => {
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(run, { timeout: 8000 });
      } else {
        run();
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [effectiveTenantId, queryClient, roleNeedsSettings]);

  return null;
}
