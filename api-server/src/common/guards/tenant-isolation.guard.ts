/**
 * ============================================================================
 * TENANT ISOLATION GUARD - ISOLATION STRICTE INTER-TENANT
 * ============================================================================
 * 
 * Guard pour garantir l'isolation stricte des données entre tenants
 * Vérifie que toutes les requêtes incluent le tenant_id correct
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';

/**
 * Vérifie si l'utilisateur est PLATFORM_OWNER
 */
function isPlatformOwner(user: any): boolean {
  if (!user) return false;
  if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') return true;
  const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL;
  if (platformOwnerEmail && user.email === platformOwnerEmail) return true;
  return false;
}

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ✅ Vérifier si le tenant est requis pour cette route
    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 🚨 Si le tenant n'est PAS requis → on laisse passer
    if (!requireTenant) {
      return true;
    }

    const user = request['user'] as any;
    
    // ✅ PLATFORM_OWNER peut bypasser le guard tenant
    if (isPlatformOwner(user)) {
      return true;
    }

    const tenantId = request['tenantId'] || 
                     request.headers['x-tenant-id'] ||
                     request.query?.tenantId ||
                     user?.tenantId;
    const body = request.body;
    const params = request.params;
    const query = request.query;

    // Vérifier que le tenant_id est présent
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    // Vérifier que l'utilisateur appartient au tenant
    const userTyped = user as any;
    if (userTyped && userTyped.tenantId && userTyped.tenantId !== tenantId) {
      throw new ForbiddenException(
        'User tenant mismatch. Access denied for security reasons.'
      );
    }

    // Vérifier que le body ne contient pas de tenant_id différent
    if (body && body.tenantId && body.tenantId !== tenantId) {
      throw new ForbiddenException(
        'Cannot modify tenant_id in request body. This is a security violation.'
      );
    }

    // Vérifier que les query params ne contiennent pas de tenant_id différent
    if (query && query.tenantId && query.tenantId !== tenantId) {
      throw new ForbiddenException(
        'Cannot specify different tenant_id in query parameters.'
      );
    }

    // Forcer le tenant_id dans le body pour les opérations CREATE/UPDATE
    if (body && typeof body === 'object' && !body.tenantId) {
      body.tenantId = tenantId;
    }

    return true;
  }
}

