/**
 * Roles Guard
 * 
 * Guard pour vérifier les rôles des utilisateurs
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    
    if (!requiredRoles) {
      return true; // Pas de rôle requis
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Récupérer le rôle et le statut super admin de l'utilisateur
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true, role: true },
    });

    // Super Admin a toujours accès
    if (dbUser?.isSuperAdmin === true || dbUser?.role === 'SUPER_ADMIN') {
      return true;
    }

    // Vérifier si le rôle de l'utilisateur correspond à l'un des rôles requis
    return requiredRoles.includes(dbUser?.role || '');
  }
}
