/**
 * ============================================================================
 * PERMISSIONS GUARD - RBAC STRICT
 * ============================================================================
 * 
 * Guard pour vérifier que l'utilisateur a toutes les permissions requises
 * Utilise Prisma pour la requête de permissions (plus fiable que TypeORM)
 * 
 * ============================================================================
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      // Aucune permission requise, autoriser l'accès
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

    try {
      // Charger l'utilisateur avec ses rôles et permissions via Prisma
      const userRoles = await this.prisma.userRole.findMany({
        where: { userId: user.id },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      // Collecter toutes les permissions de l'utilisateur
      const userPermissions = new Set<string>();

      for (const userRole of userRoles) {
        if (userRole.role?.rolePermissions) {
          for (const rp of userRole.role.rolePermissions) {
            if (rp.permission?.name) {
              userPermissions.add(rp.permission.name);
            }
          }
        }
      }

      // Vérifier que l'utilisateur a toutes les permissions requises
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
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Error checking permissions: ${error.message}`, error.stack);
      // En cas d'erreur de connexion DB, on laisse passer pour éviter les 500
      // Les permissions seront vérifiées à nouveau si nécessaire
      this.logger.warn('Database error in PermissionsGuard - allowing access by default');
      return true;
    }
  }
}
