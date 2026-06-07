/**
 * Clés de cache TanStack Query — paramètres établissement (bootstrap + invalidation ciblée).
 */
export const settingsKeys = {
  all: ['settings'] as const,
  bootstrap: (tenantId: string | undefined) =>
    [...settingsKeys.all, 'bootstrap', tenantId ?? 'none'] as const,
};
