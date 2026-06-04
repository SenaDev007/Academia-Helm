/**
 * ============================================================================
 * PERMISSIONS CONTROLLER - ENDPOINT POUR PERMISSIONS UI
 * ============================================================================
 * 
 * Fournit les permissions de l'utilisateur connecté pour le frontend
 * 
 * ============================================================================
 */

import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PortalAccessGuard } from '../guards/portal-access.guard';
import { PermissionsService } from '../services/permissions.service';
import { UserRole } from '../enums/user-role.enum';

@Controller('common/permissions')
@UseGuards(JwtAuthGuard, PortalAccessGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * Récupère les permissions de l'utilisateur connecté
   * Utilisé par le frontend pour conditionner l'UI
   */
  @Get('my-permissions')
  async getMyPermissions(@Request() req: any) {
    const userRole = req.userRole as UserRole;

    if (!userRole) {
      return {
        error: 'User role not found',
      };
    }

    return {
      role: userRole,
      portal: this.permissionsService.getAuthorizedPortal(userRole),
      permissions: this.permissionsService.getPermissionsForUI(userRole),
      accessibleModules: this.permissionsService.getAccessibleModules(userRole),
      // Format pour le frontend
      modules: this.formatPermissionsForUI(userRole),
    };
  }

  /**
   * Formate les permissions pour le frontend
   */
  private formatPermissionsForUI(role: UserRole) {
    const permissions = this.permissionsService.getPermissionsForUI(role);
    const result: Record<string, { canRead: boolean; canWrite: boolean; canDelete: boolean; canManage: boolean }> = {};

    permissions.forEach(({ module, action }) => {
      result[module] = {
        canRead: action !== null,
        canWrite: action === 'WRITE' || action === 'MANAGE',
        canDelete: action === 'DELETE' || action === 'MANAGE',
        canManage: action === 'MANAGE',
      };
    });

    return result;
  }
}
