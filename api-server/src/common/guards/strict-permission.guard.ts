/**
 * ============================================================================
 * STRICT PERMISSION GUARD - VERROUILLAGE STRICT DES PERMISSIONS
 * ============================================================================
 * 
 * Guard qui vérifie strictement les permissions selon la matrice officielle.
 * 
 * ⚠️ Aucune permission implicite
 * ⚠️ Tous les refus sont tracés
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
import { UserRole } from '../enums/user-role.enum';
import { StrictPermissionsService } from '../services/strict-permissions.service';
import { AccessDeniedLogService } from '../services/access-denied-log.service';

@Injectable()
export class StrictPermissionGuard implements CanActivate {
  private readonly logger = new Logger(StrictPermissionGuard.name);

  constructor(
    private reflector: Reflector,
    private strictPermissionsService: StrictPermissionsService,
    private accessDeniedLogService: AccessDeniedLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    // Récupérer le module requis
    const requiredModule = this.reflector.getAllAndOverride<Module>(
      REQUIRED_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Récupérer l'action requise (par défaut: READ)
    const requiredAction =
      this.reflector.getAllAndOverride<PermissionAction>(REQUIRED_PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || PermissionAction.READ;

    // Si aucun module requis, autoriser (autres guards peuvent gérer)
    if (!requiredModule) {
      return true;
    }

    // Récupérer le rôle de l'utilisateur
    const userRole = request['userRole'] as UserRole || this.getUserRole(user);
    if (!userRole) {
      await this.logAccessDenied(user, requiredModule, requiredAction, 'Role not defined', request);
      throw new ForbiddenException('User role not defined');
    }

    // Vérifier la permission stricte
    const hasPermission = this.strictPermissionsService.hasPermission(
      userRole,
      requiredModule,
      requiredAction,
      user,
    );

    if (!hasPermission) {
      // Tracer le refus d'accès
      await this.logAccessDenied(
        user,
        requiredModule,
        requiredAction,
        `Role ${userRole} does not have ${requiredAction} permission on module ${requiredModule}`,
        request, // ✅ Passer la requête pour récupérer tenantId, IP, User-Agent
      );

      const userId = (user as any).id || 'unknown';
      this.logger.warn(
        `🚫 Access denied: User ${userId} (Role: ${userRole}) attempted ${requiredAction} on module ${requiredModule}`,
      );

      throw new ForbiddenException(
        `Access denied: Your role (${userRole}) does not have '${requiredAction}' permission on the '${requiredModule}' module.`,
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
      return user.role as UserRole;
    }
    return null;
  }

  /**
   * Trace un refus d'accès
   */
  private async logAccessDenied(
    user: any,
    module: Module,
    action: PermissionAction,
    reason: string,
    request?: Request,
  ): Promise<void> {
    try {
      // Récupérer tenantId depuis la requête ou l'utilisateur
      const tenantId = request?.['tenantId'] || user?.tenantId || null;
      
      // Récupérer IP et User-Agent depuis la requête
      const ipAddress = request?.ip || request?.headers['x-forwarded-for'] || null;
      const userAgent = request?.headers['user-agent'] || null;

      await this.accessDeniedLogService.log(
        {
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        module,
        action,
        reason,
          ipAddress: typeof ipAddress === 'string' ? ipAddress : null,
          userAgent: typeof userAgent === 'string' ? userAgent : null,
        timestamp: new Date(),
        },
        tenantId, // ✅ Passer tenantId depuis le contexte
      );
    } catch (error) {
      this.logger.error('Failed to log access denied', error);
    }
  }
}
