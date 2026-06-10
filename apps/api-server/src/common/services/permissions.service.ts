/**
 * ============================================================================
 * PERMISSIONS SERVICE - CALCUL DYNAMIQUE DES PERMISSIONS
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { Module } from '../enums/module.enum';
import { PermissionAction } from '../enums/permission-action.enum';
import { getRolePermissions, hasPermission } from '../permissions/role-permissions.matrix';
import { Portal, ROLE_PORTAL_MAP } from '../enums/user-role.enum';

@Injectable()
export class PermissionsService {
  /**
   * Vérifie si un rôle a une permission sur un module
   */
  hasPermission(role: UserRole, module: Module, action?: PermissionAction): boolean {
    return hasPermission(role, module, action);
  }

  /**
   * Récupère toutes les permissions d'un rôle
   */
  getRolePermissions(role: UserRole): Record<Module, PermissionAction | null> {
    return getRolePermissions(role);
  }

  /**
   * Récupère les modules accessibles pour un rôle (avec au moins READ)
   */
  getAccessibleModules(role: UserRole): Module[] {
    const permissions = getRolePermissions(role);
    return Object.entries(permissions)
      .filter(([_, permission]) => permission !== null)
      .map(([module]) => module as Module);
  }

  /**
   * Récupère le portail autorisé pour un rôle
   */
  getAuthorizedPortal(role: UserRole): Portal {
    return ROLE_PORTAL_MAP[role];
  }

  /**
   * Vérifie si un rôle peut accéder à un portail
   */
  canAccessPortal(role: UserRole, portal: Portal): boolean {
    return ROLE_PORTAL_MAP[role] === portal;
  }

  /**
   * Récupère les permissions formatées pour l'UI
   */
  getPermissionsForUI(role: UserRole): Array<{ module: Module; action: PermissionAction | null }> {
    const permissions = getRolePermissions(role);
    return Object.entries(permissions).map(([module, action]) => ({
      module: module as Module,
      action,
    }));
  }
}
