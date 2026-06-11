import { Request } from 'express';

/**
 * Résout tenant_id pour @TenantId / @GetTenant (sans dépendre uniquement de TenantGuard).
 * Ordre : valeur déjà posée sur la requête → X-Tenant-ID → utilisateur JWT → query.
 */
export function resolveRequestTenantId(request: Request): string | undefined {
  const existing = request['tenantId'];
  if (existing && typeof existing === 'string') {
    return existing;
  }

  const headerRaw = request.headers['x-tenant-id'];
  const fromHeader =
    typeof headerRaw === 'string'
      ? headerRaw
      : Array.isArray(headerRaw)
        ? headerRaw[0]
        : undefined;
  if (fromHeader) return fromHeader;

  const user = request['user'] as { tenantId?: string | null } | undefined;
  if (user?.tenantId && typeof user.tenantId === 'string') {
    return user.tenantId;
  }

  const q = request.query as Record<string, unknown> | undefined;
  const tq = q?.tenant_id ?? q?.tenantId;
  const fromQuery = Array.isArray(tq) ? tq[0] : tq;
  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    return fromQuery;
  }

  return undefined;
}
