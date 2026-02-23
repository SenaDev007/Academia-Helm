import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

/**
 * Guard to extract and validate tenant_id from request
 * 
 * Resolves tenant from:
 * 1. Subdomain (e.g., school-a.academiahub.com)
 * 2. X-Tenant-ID header
 * 3. JWT token payload (after authentication)
 * 
 * ⚠️ IMPORTANT: Ce guard ne doit JAMAIS être appliqué sur les routes d'authentification
 */
@Injectable()
export class TenantGuard implements CanActivate {
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

    // ✅ PLATFORM_OWNER peut bypasser
    const user = request['user'] as any;
    if (user && (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN')) {
      return true;
    }

    const tenantId = this.extractTenantId(request);

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found');
    }

    // Attach tenantId to request for use in controllers/services
    request['tenantId'] = tenantId;
    return true;
  }

  private extractTenantId(request: Request): string | undefined {
    // Option 1: From subdomain (e.g., school-a.academiahub.com)
    const host = request.headers.host;
    if (host && host.includes('.')) {
      const parts = host.split('.');
      if (parts.length > 2 && parts[0] !== 'www') {
        // First part is the tenant slug/id
        // TODO: Resolve slug to tenant_id via database lookup
        return parts[0];
      }
    }

    // Option 2: From X-Tenant-ID header
    const tenantIdHeader = request.headers['x-tenant-id'];
    if (tenantIdHeader && typeof tenantIdHeader === 'string') {
      return tenantIdHeader;
    }

    // Option 3: From JWT payload (after authentication)
    // This is typically handled by an AuthGuard that decodes the JWT
    // and attaches user/tenant info to the request
    const user = request['user'] as any;
    if (user && user.tenantId) {
      return user.tenantId;
    }

    return undefined;
  }
}
