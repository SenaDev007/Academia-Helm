/**
 * ============================================================================
 * MODULE PERMISSION GUARD — Delegates to the DB-backed PermissionGuard
 * ============================================================================
 *
 * Previously this guard used a static in-memory permission matrix
 * (StrictPermissionsService + strict-permissions.matrix.ts). That static
 * system was dead code that never reflected the actual DB permissions.
 *
 * Now this guard is a thin pass-through: the real permission check is done
 * by `PermissionGuard` (which reads from the `user_roles` + `role_permissions`
 * DB tables). This guard is kept for backward compatibility with controllers
 * that reference it in their @UseGuards chain — it simply passes all
 * authenticated, non-public requests through to the next guard.
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Bypass for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // The actual permission check is performed by PermissionGuard
    // (which reads from the DB user_roles + role_permissions tables).
    // This guard is a pass-through for backward compatibility.
    return true;
  }
}
