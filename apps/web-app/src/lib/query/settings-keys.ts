/**
 * Clés de cache TanStack Query — paramètres établissement (bootstrap + invalidation ciblée).
 */
export const settingsKeys = {
  all: ['settings'] as const,
  bootstrap: (tenantId: string | undefined) =>
    [...settingsKeys.all, 'bootstrap', tenantId ?? 'none'] as const,
  /**
   * ⭐ PERF (chantier GTMetrix) — variante « core » du bootstrap (5 données
   * chaudes : general, features, années scolaires, identity, bilingual).
   * Utilisée par le prefetch post-login ; la page Paramètres utilise la
   * clé `bootstrap` complète (23 sources) à la demande.
   */
  bootstrapCore: (tenantId: string | undefined) =>
    [...settingsKeys.all, 'bootstrap-core', tenantId ?? 'none'] as const,
};
