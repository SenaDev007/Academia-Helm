'use client';

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSession } from '@/contexts/AppSessionContext';
import { settingsKeys } from '@/lib/query/settings-keys';
import { fetchSettingsBootstrap } from '@/lib/query/fetch-settings-bootstrap';
import type { SettingsBootstrapPayload } from '@/lib/query/fetch-settings-bootstrap';
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
 * Précharge le bundle Paramètres dès que le tenant effectif est connu (en parallèle du splash post-login).
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
    /** Court délai pour laisser localStorage/cookies alignés après redirection login (Bearer pour le proxy). */
    const t = window.setTimeout(() => {
      void queryClient
        .prefetchQuery({
          queryKey: settingsKeys.bootstrap(effectiveTenantId),
          queryFn: () => fetchSettingsBootstrap(effectiveTenantId),
          staleTime: BOOTSTRAP_STALE_MS,
        })
        .then(() => {
          const data = queryClient.getQueryData<SettingsBootstrapPayload>(
            settingsKeys.bootstrap(effectiveTenantId),
          );
          if (data?.academicYearsResult) {
            hydrateAcademicYearsFromBootstrap(queryClient, effectiveTenantId, data);
          }
        });
    }, 80);
    return () => clearTimeout(t);
  }, [effectiveTenantId, queryClient, roleNeedsSettings]);

  return null;
}
