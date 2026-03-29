/**
 * ============================================================================
 * CONVENTIONS TanStack Query — Academia Helm
 * ============================================================================
 *
 * Clés centralisées :
 * - `settingsKeys` — bundle Paramètres (bootstrap)
 * - `academicYearsKeys` — liste années + isCurrent (sélecteur global)
 * - `pedagogyKeys` — agrégats tableau de bord pédagogie (par année scolaire)
 *
 * Lecture :
 * - `useQuery` + `queryFn` qui appellent les services `/api/...` existants
 * - `staleTime` 1–2 min pour données métier ; ajuster par écran si besoin
 * - Hydratation : après `fetchSettingsBootstrap`, appeler `hydrateAcademicYearsFromBootstrap`
 *   pour éviter un second aller réseau sur les années
 *
 * Écriture :
 * - `useMutation` avec `onSuccess` → `queryClient.invalidateQueries({ queryKey: ... })`
 * - Optimistic UI : `onMutate` + snapshot rollback dans `onError` (cas avancé, au besoin)
 *
 * Invalidation tenant :
 * - Après mutation impactant plusieurs écrans : invalider `settingsKeys.bootstrap(tenantId)`
 *   et `academicYearsKeys.all` si années / structure touchées
 *
 * Nouveaux modules : ajouter un fichier `*-keys.ts` dans `lib/query/` et exporter depuis `index.ts`.
 * ============================================================================
 */

export const TANSTACK_QUERY_HELM_VERSION = 1 as const;
