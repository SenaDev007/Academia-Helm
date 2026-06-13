import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { RESERVED_SUBDOMAINS, isReservedSubdomain } from '../constants/reserved-subdomains';

/**
 * Guard to extract and validate tenant_id from request
 *
 * Resolves tenant from (ordre de priorité) :
 * 1. X-Tenant-ID header (explicite, priorité maximale)
 * 2. JWT token payload (tenant sélectionné via /auth/select-tenant)
 * 3. Subdomain (e.g., cspeb.academiahelm.com) — dernier recours
 *
 * ⚠️ IMPORTANT: Ce guard ne doit JAMAIS être appliqué sur les routes d'authentification
 */
@Injectable()
export class TenantGuard implements CanActivate {
  /**
   * Sous-domaines réservés importés depuis la source centralisée.
   * @see apps/api-server/src/common/constants/reserved-subdomains.ts
   */
  private static readonly RESERVED_SUBDOMAINS = RESERVED_SUBDOMAINS;

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.route?.path || '';

    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ✅ Exclure explicitement les routes d'authentification et de portail
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/select-tenant') ||
      path.includes('/auth/dev-login') ||
      path.includes('/auth/dev-available-tenants') ||
      path.includes('/auth/available-tenants') ||
      path.includes('/portal/auth') ||
      path.includes('/portal/search') ||
      path.includes('/portal/list') ||
      path.includes('/public/schools')
    ) {
      return true;
    }

    const user = request['user'] as any;
    const isPlatform =
      user && (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN');

    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      if (isPlatform) {
        return true;
      }
      throw new UnauthorizedException('Tenant ID not found');
    }

    request['tenantId'] = tenantId;
    return true;
  }

  private extractTenantId(request: Request): string | undefined {
    // Option 1: From X-Tenant-ID header (PRIORITÉ — explicite, pas ambigu)
    const tenantIdHeader = request.headers['x-tenant-id'];
    if (tenantIdHeader && typeof tenantIdHeader === 'string') {
      return tenantIdHeader;
    }

    // Option 2: From JWT payload (tenant sélectionné via /auth/select-tenant)
    const user = request['user'] as any;
    if (user && user.tenantId) {
      return user.tenantId;
    }

    // Option 3: From subdomain (e.g., cspeb.academiahelm.com)
    // ⚠️ DERNIER recours — les sous-domaines réservés (api, www, app…) sont ignorés
    const host = request.headers.host;
    if (host && host.includes('.')) {
      const parts = host.split('.');
      if (
        parts.length > 2 &&
        !isReservedSubdomain(parts[0].toLowerCase())
      ) {
        // First part is the tenant slug/id
        // TODO: Resolve slug to tenant_id via database lookup
        return parts[0];
      }
    }

    return undefined;
  }
}
