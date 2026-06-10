/**
 * ============================================================================
 * PERMISSIONS GUARD - RBAC STRICT
 * ============================================================================
 * 
 * Guard pour vérifier que l'utilisateur a toutes les permissions requises
 * Utilise les permissions déjà extraites par JwtStrategy (dans request.user.permissions)
 * au lieu de refaire une requête DB à chaque vérification.
 * 
 * v2: Optimisation — utilise user.permissions du JWT (extrait par JwtStrategy)
 *     au lieu de re-interroger la DB pour chaque guard.
 * ============================================================================
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super admin a accès à tout
    if (user.isSuperAdmin) {
      return true;
    }

    // Use permissions already extracted by JwtStrategy (cached with user) — no DB query needed
    const userPermissions: Set<string> = new Set(user.permissions || []);

    const hasAllPermissions = requiredPermissions.every(permission =>
      userPermissions.has(permission)
    );

    if (!hasAllPermissions) {
      const missing = requiredPermissions.filter(p => !userPermissions.has(p));
      throw new ForbiddenException(
        `Access denied. Missing permissions: ${missing.join(', ')}`
      );
    }

    return true;
  }
}
