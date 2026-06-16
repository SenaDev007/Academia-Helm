import { Request } from 'express';

/**
 * Résout tenant_id pour @TenantId / @GetTenant (sans dépendre uniquement de TenantGuard).
 *
 * 🔒 SÉCURITÉ (v2) : Le JWT est la source de vérité. Les query params (?tenantId=)
 * et headers x-tenant-id ne sont PLUS acceptés directement — ils doivent
 * correspondre au tenant du JWT (vérifié par TenantGuard). Cette fonction
 * retourne donc UNIQUEMENT :
 *   1. La valeur déjà posée sur la requête par TenantGuard (sécurisée)
 *   2. Le tenant du JWT (user.tenantId)
 *
 * Les sources non sécurisées (header, query) ont été retirées pour empêcher
 * l'usurpation cross-tenant.
 */
export function resolveRequestTenantId(request: Request): string | undefined {
  // Option 1 : valeur déjà posée par TenantGuard (qui a fait les vérifications)
  const existing = request['tenantId'];
  if (existing && typeof existing === 'string') {
    return existing;
  }

  // Option 2 : tenant du JWT (source de vérité)
  const user = request['user'] as { tenantId?: string | null } | undefined;
  if (user?.tenantId && typeof user.tenantId === 'string') {
    return user.tenantId;
  }

  return undefined;
}
