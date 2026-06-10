/**
 * ============================================================================
 * CONTEXT VALIDATION GUARD - INTERDIT LES REQUÊTES AMBIGUËS
 * ============================================================================
 * 
 * Guard qui interdit toute requête ambiguë :
 * - Sans tenant_id
 * - Sans school_level_id
 * - Sans module_type
 * 
 * Ce guard doit être appliqué GLOBALEMENT pour garantir
 * qu'aucune requête ne passe sans contexte complet.
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
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
export class ContextValidationGuard implements CanActivate {
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
    // Ces routes ne nécessitent PAS de tenant avant l'authentification
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/select-tenant') ||
      path.includes('/auth/dev-login') ||
      path.includes('/auth/dev-available-tenants') ||
      path.includes('/portal/auth') ||
      path.includes('/portal/search') ||
      path.includes('/portal/list') ||
      path.includes('/public/schools')
    ) {
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

    // Vérifier que le contexte a été résolu par ContextInterceptor
    const contextData = request['context'];
    
    if (!contextData) {
      // Le contexte n'a pas été résolu, vérifier manuellement
      const user = request['user'] as any;
      const tenantId = request['tenantId'] || 
                       request.headers['x-tenant-id'] ||
                       user?.tenantId;

      if (!tenantId) {
        throw new ForbiddenException(
          'Tenant ID is required. Please provide X-Tenant-ID header or authenticate.'
        );
      }

      const schoolLevelId = request['schoolLevelId'] ||
                            request.headers['x-school-level-id'] ||
                            request.query?.schoolLevelId ||
                            request.body?.schoolLevelId;

      if (!schoolLevelId) {
        throw new BadRequestException(
          'School Level ID is required. All operations must be scoped to a school level. ' +
          'Please provide X-School-Level-ID header or schoolLevelId query parameter.'
        );
      }

      const moduleType = request['moduleType'] ||
                         request.headers['x-module-type'];

      if (!moduleType) {
        throw new BadRequestException(
          'Module type is required. All operations must be scoped to a module. ' +
          'Please provide X-Module-Type header or use a module-specific route.'
        );
      }
    } else {
      // Le contexte a été résolu, vérifier qu'il est complet
      if (!contextData.tenantId) {
        throw new ForbiddenException('Tenant ID is missing from context');
      }

      if (!contextData.schoolLevelId) {
        throw new BadRequestException(
          'School Level ID is missing from context. All operations must be scoped to a school level.'
        );
      }

      if (!contextData.moduleType) {
        throw new BadRequestException(
          'Module type is missing from context. All operations must be scoped to a module.'
        );
      }
    }

    return true;
  }
}

