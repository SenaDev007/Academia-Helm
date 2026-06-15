/**
 * ============================================================================
 * STRICT PERMISSIONS SERVICE - SERVICE DE VÉRIFICATION STRICTE
 * ============================================================================
 * 
 * Service pour vérifier les permissions de manière stricte
 * selon la matrice officielle.
 * 
 * ⚠️ Aucune permission implicite
 * ⚠️ Promoteur = super-set
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';
import {
  hasStrictPermission,
  getAllowedRoles,
  STRICT_PERMISSIONS_MATRIX,
} from '../permissions/strict-permissions.matrix';
import { PlatformOwnerService } from '../../security/platform-owner.service';

@Injectable()
export class StrictPermissionsService {
  private readonly logger = new Logger(StrictPermissionsService.name);

  constructor(private readonly platformOwnerService: PlatformOwnerService) {}

  /**
   * Vérifie si un rôle a une permission stricte sur un module
   * 
   * @param role Rôle de l'utilisateur
   * @param module Module requis
   * @param action Action requise
   * @param user Utilisateur (pour vérifier PLATFORM_OWNER)
   * @returns true si autorisé, false sinon
   */
  hasPermission(
    role: UserRole,
    module: Module,
    action: PermissionAction,
    user?: any,
  ): boolean {
    // PLATFORM_OWNER bypass (dev only)
    if (user && this.platformOwnerService.isPlatformOwner(user)) {
      this.logger.debug(`🔐 PLATFORM_OWNER bypassing permission check`);
      return true;
    }

    // Super Admin a accès à tout (plateforme)
    if (role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Vérification stricte
    return hasStrictPermission(role, module, action);
  }

  /**
   * Récupère tous les rôles autorisés pour une action sur un module
   */
  getAllowedRoles(module: Module, action: PermissionAction): UserRole[] {
    return getAllowedRoles(module, action);
  }

  /**
   * Vérifie si un module existe dans la matrice
   */
  moduleExists(module: Module): boolean {
    return module in STRICT_PERMISSIONS_MATRIX;
  }

  /**
   * Vérifie si une action existe pour un module
   */
  actionExists(module: Module, action: PermissionAction): boolean {
    const modulePermissions = STRICT_PERMISSIONS_MATRIX[module];
    if (!modulePermissions) {
      return false;
    }
    return action in modulePermissions;
  }

  /**
   * Récupère toutes les permissions d'un rôle pour un module
   */
  getRolePermissionsForModule(role: UserRole, module: Module): PermissionAction[] {
    const modulePermissions = STRICT_PERMISSIONS_MATRIX[module];
    if (!modulePermissions) {
      return [];
    }

    const permissions: PermissionAction[] = [];

    // Promoteur a toutes les permissions
    if (role === UserRole.PROMOTEUR) {
      return Object.keys(modulePermissions) as PermissionAction[];
    }

    // Vérifier chaque action
    for (const [action, allowedRoles] of Object.entries(modulePermissions)) {
      if (allowedRoles.includes(role)) {
        permissions.push(action as PermissionAction);
      }
    }

    return permissions;
  }

  /**
   * Récupère tous les modules accessibles par un rôle
   */
  getAccessibleModules(role: UserRole): Module[] {
    // Promoteur a accès à tous les modules
    if (role === UserRole.PROMOTEUR) {
      return Object.keys(STRICT_PERMISSIONS_MATRIX) as Module[];
    }

    const modules: Module[] = [];

    for (const [module, permissions] of Object.entries(STRICT_PERMISSIONS_MATRIX)) {
      // Vérifier si le rôle a au moins une permission sur ce module
      const hasAnyPermission = Object.values(permissions).some((allowedRoles) =>
        allowedRoles.includes(role),
      );

      if (hasAnyPermission) {
        modules.push(module as Module);
      }
    }

    return modules;
  }
}
