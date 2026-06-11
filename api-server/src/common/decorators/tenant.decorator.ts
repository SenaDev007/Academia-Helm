import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { resolveRequestTenantId } from '../utils/resolve-request-tenant-id';

/**
 * Objet minimal { id } pour les contrôleurs qui attendaient request.tenant (souvent absent).
 * Si un tenant complet est attaché plus tard sur la requête, il est utilisé en priorité.
 */
export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): { id: string } | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const full = request['tenant'] as { id: string } | undefined;
    if (full) return full;
    const id = resolveRequestTenantId(request);
    return id ? { id } : undefined;
  },
);

export const GetTenant = Tenant;
