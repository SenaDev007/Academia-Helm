/**
 * ============================================================================
 * MODULE PERMISSION GUARD - VÉRIFICATION PERMISSIONS PAR MODULE
 * ============================================================================
 * 
 * Vérifie que l'utilisateur a la permission requise sur un module
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
import { UserRole } from '../enums/user-role.enum';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';
import { StrictPermissionsService } from '../services/strict-permissions.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRED_MODULE_KEY } from '../decorators/required-module.decorator';
import { REQUIRED_PERMISSION_KEY } from '../decorators/required-permission.decorator';
import { PlatformOwnerService } from '../../security/platform-owner.service';

@Injectable()
export class ModulePermissionGuard implements CanActivate {
  private readonly logger = new Logger(ModulePermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private platformOwnerService: PlatformOwnerService,
    private strictPermissionsService: StrictPermissionsService,
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
      throw new ForbiddenException('User not authenticated');
    }

    // BYPASS si PLATFORM_OWNER (dev only)
    if (this.platformOwnerService.isPlatformOwner(user)) {
      this.logger.debug(`🔐 PLATFORM_OWNER bypassing permission check`);
      return true;
    }

    // Récupérer le rôle de l'utilisateur
    const userRole = request.userRole || this.getUserRole(user);
    if (!userRole) {
      throw new ForbiddenException('User role not defined');
    }

    // Récupérer le module requis depuis le décorateur
    const requiredModule = this.reflector.getAllAndOverride<Module>(REQUIRED_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredModule) {
      // Aucun module requis, autoriser
      return true;
    }

    // Récupérer l'action requise (par défaut: READ)
    const requiredAction = this.reflector.getAllAndOverride<PermissionAction>(
      REQUIRED_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    ) || PermissionAction.READ;

    // Vérifier la permission stricte
    if (!this.strictPermissionsService.hasPermission(userRole, requiredModule, requiredAction, user)) {
      this.logger.warn(
        `Permission denied: User ${user.id} with role ${userRole} attempted ${requiredAction} on module ${requiredModule}`,
      );
      throw new ForbiddenException(
        `Access denied: Role ${userRole} does not have ${requiredAction} permission on module ${requiredModule}`,
      );
    }

    return true;
  }

  /**
   * Récupère le rôle de l'utilisateur
   */
  private getUserRole(user: any): UserRole | null {
    if (user.isSuperAdmin) {
      return UserRole.SUPER_ADMIN;
    }

    if (user.role) {
      const role = user.role.toUpperCase();
      const roleMap: Record<string, UserRole> = {
        'SUPER_ADMIN': UserRole.SUPER_ADMIN,
        'PROMOTEUR': UserRole.PROMOTEUR,
        'PROMOTER': UserRole.PROMOTEUR,
        'DIRECTEUR': UserRole.DIRECTEUR,
        'DIRECTOR': UserRole.DIRECTEUR,
        'SECRETAIRE': UserRole.SECRETAIRE,
        'SECRETARY': UserRole.SECRETAIRE,
        'COMPTABLE': UserRole.COMPTABLE,
        'ACCOUNTANT': UserRole.COMPTABLE,
        'SECRETAIRE_COMPTABLE': UserRole.SECRETAIRE_COMPTABLE,
        'SECRETARY_ACCOUNTANT': UserRole.SECRETAIRE_COMPTABLE,
        'CENSEUR': UserRole.CENSEUR,
        'SURVEILLANT': UserRole.SURVEILLANT,
        'ENSEIGNANT': UserRole.ENSEIGNANT,
        'TEACHER': UserRole.ENSEIGNANT,
        'PARENT': UserRole.PARENT,
        'ELEVE': UserRole.ELEVE,
        'STUDENT': UserRole.ELEVE,
      };

      return roleMap[role] || null;
    }

    return null;
  }
}
