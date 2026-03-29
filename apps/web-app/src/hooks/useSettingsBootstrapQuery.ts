'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsKeys } from '@/lib/query/settings-keys';
import { academicYearsKeys } from '@/lib/query/academic-years-keys';
import {
  fetchSettingsBootstrap,
  type SettingsBootstrapPayload,
} from '@/lib/query/fetch-settings-bootstrap';

const STALE_MS = 2 * 60 * 1000;

type UseSettingsBootstrapOptions = {
  /** Par défaut `true` (charge même sans tenant, comme l’API bootstrap). Mettre `false` pour désactiver. */
  enabled?: boolean;
};

/**
 * Données paramètres partagées — même cache que la page Paramètres et le préchargement layout.
 */
export function useSettingsBootstrapQuery(
  tenantId: string | undefined,
  options?: UseSettingsBootstrapOptions,
) {
  return useQuery({
    queryKey: settingsKeys.bootstrap(tenantId),
    queryFn: () => fetchSettingsBootstrap(tenantId),
    enabled: options?.enabled !== false,
    staleTime: STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useInvalidateSettingsBootstrap() {
  const queryClient = useQueryClient();
  return (tenantId: string | undefined) =>
    queryClient.invalidateQueries({ queryKey: settingsKeys.bootstrap(tenantId) });
}

/**
 * Invalide bootstrap Paramètres + années scolaires (ex. après changement d’année ou structure).
 */
export function useInvalidateTenantCaches() {
  const queryClient = useQueryClient();
  return async (tenantId: string | undefined) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: settingsKeys.bootstrap(tenantId) }),
      queryClient.invalidateQueries({ queryKey: academicYearsKeys.all }),
    ]);
  };
}

export type { SettingsBootstrapPayload };
