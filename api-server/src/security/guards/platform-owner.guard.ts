/**
 * ============================================================================
 * PLATFORM OWNER GUARD - BYPASS RBAC (DEV ONLY)
 * ============================================================================
 * 
 * Ce guard permet au PLATFORM_OWNER de bypasser toutes les vérifications
 * RBAC en environnement development.
 * 
 * ⚠️ En production, ce guard ne fait rien (PLATFORM_OWNER n'existe pas)
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformOwnerService } from '../platform-owner.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

@Injectable()
export class PlatformOwnerGuard implements CanActivate {
  private readonly logger = new Logger(PlatformOwnerGuard.name);

  constructor(
    private readonly platformOwnerService: PlatformOwnerService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false; // Laisser les autres guards gérer l'authentification
    }

    // Vérifier si c'est le PLATFORM_OWNER
    if (this.platformOwnerService.isPlatformOwner(user)) {
      this.logger.debug(
        `🔐 PLATFORM_OWNER bypassing RBAC for ${user.email}`,
      );
      return true; // BYPASS TOTAL
    }

    // Si ce n'est pas le PLATFORM_OWNER, laisser passer
    // Les autres guards (PortalAccessGuard, ModulePermissionGuard) feront leur travail
    return true;
  }
}
