/**
 * ============================================================================
 * ORION READONLY GUARD - ORION = LECTURE SEULE
 * ============================================================================
 * 
 * Guard spécial pour ORION : lecture seule, jamais d'écriture.
 * 
 * ⚠️ ORION ne permet JAMAIS :
 * - CREATE
 * - UPDATE
 * - DELETE
 * - MANAGE
 * 
 * ⚠️ ORION permet UNIQUEMENT :
 * - READ
 * - ACCESS_ORION
 * - EXPORT
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRED_MODULE_KEY } from '../decorators/required-module.decorator';
import { REQUIRED_PERMISSION_KEY } from '../decorators/required-permission.decorator';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';
import { PlatformOwnerService } from '../../security/platform-owner.service';

// Actions interdites pour ORION
const ORION_FORBIDDEN_ACTIONS = [
  PermissionAction.WRITE,
  PermissionAction.DELETE,
  PermissionAction.MANAGE,
];

// Actions autorisées pour ORION (lecture seule)
const ORION_ALLOWED_ACTIONS = [
  PermissionAction.READ, // Seule action autorisée
];

@Injectable()
export class OrionReadonlyGuard implements CanActivate {
  private readonly logger = new Logger(OrionReadonlyGuard.name);

  constructor(
    private reflector: Reflector,
    private platformOwnerService: PlatformOwnerService,
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

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'];

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // PLATFORM_OWNER bypass (dev only)
    if (this.platformOwnerService.isPlatformOwner(user)) {
      return true;
    }

    // Récupérer le module requis
    const requiredModule = this.reflector.getAllAndOverride<Module>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Si ce n'est pas le module ORION, laisser passer
    if (requiredModule !== Module.ORION) {
      return true;
    }

    // Récupérer l'action requise
    const requiredAction =
      this.reflector.getAllAndOverride<PermissionAction>(REQUIRED_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || PermissionAction.READ;

    // Vérifier si l'action est interdite pour ORION
    if (ORION_FORBIDDEN_ACTIONS.includes(requiredAction)) {
      const userId = (user as any).id || 'unknown';
      this.logger.warn(
        `🚫 ORION readonly violation: User ${userId} attempted ${requiredAction} on ORION module`,
      );
      throw new ForbiddenException(
        `ORION is read-only. Action '${requiredAction}' is not allowed on the ORION module.`,
      );
    }

    // Vérifier si l'action est autorisée
    if (!ORION_ALLOWED_ACTIONS.includes(requiredAction)) {
      const userId = (user as any).id || 'unknown';
      this.logger.warn(
        `🚫 ORION readonly violation: User ${userId} attempted ${requiredAction} on ORION module`,
      );
      throw new ForbiddenException(
        `ORION is read-only. Action '${requiredAction}' is not allowed on the ORION module.`,
      );
    }

    return true;
  }
}
