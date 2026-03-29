import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { resolveRequestTenantId } from '../utils/resolve-request-tenant-id';

/**
 * Extrait le tenant_id (header X-Tenant-ID, JWT enrichi, query, ou TenantGuard).
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return resolveRequestTenantId(request);
  },
);
