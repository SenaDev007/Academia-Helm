/**
 * ============================================================================
 * TENANT REQUIRED GUARD - GUARD OPTIONNEL POUR ROUTES MÉTIER
 * ============================================================================
 * 
 * Ce guard ne s'applique QUE si la route est marquée avec @RequireTenant()
 * 
 * Architecture correcte :
 * - Routes publiques : Pas de guard tenant
 * - Routes authentifiées sans tenant : AuthGuard seulement
 * - Routes métier : @RequireTenant() + TenantRequiredGuard
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

/**
 * Vérifie si l'utilisateur est PLATFORM_OWNER
 */
function isPlatformOwner(user: any): boolean {
  if (!user) return false;
  
  // Vérifier le rôle
  if (user.role === 'PLATFORM_OWNER' || user.role === 'SUPER_ADMIN') {
    return true;
  }
  
  // Vérifier l'email (fallback)
  const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL;
  if (platformOwnerEmail && user.email === platformOwnerEmail) {
    return true;
  }
  
  return false;
}

@Injectable()
export class TenantRequiredGuard implements CanActivate {
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
      console.log('[TenantRequiredGuard] ✅ PLATFORM_OWNER détecté - Bypass tenant');
      return true;
    }

    // ✅ Vérifier que le tenant est présent
    const tenantId = request['tenantId'] || 
                     request.headers['x-tenant-id'] ||
                     request.query?.tenantId ||
                     user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException(
        'Tenant ID is required for this operation. ' +
        'Please provide X-Tenant-ID header or select a tenant.'
      );
    }

    // Attacher le tenantId à la requête pour les guards suivants
    request['tenantId'] = tenantId;

    return true;
  }
}
