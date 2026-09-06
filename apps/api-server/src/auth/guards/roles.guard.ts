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

    const userRole = dbUser?.role || '';

    // Vérifier si le rôle de l'utilisateur correspond à l'un des rôles requis
    if (requiredRoles.includes(userRole)) {
      return true;
    }

    // ⭐ FIX 2026-09-06 (F12) — normalisation des suffixes de niveau :
    //    un rôle niveau-spécifique (ex: SECRETAIRE_COMPTABLE_SEC, produit par
    //    resolveUserRoleWithLevel depuis les affectations) doit matcher un
    //    @Roles('SECRETAIRE_COMPTABLE'). AVANT, le rôle RESTRICTIF était
    //    rejeté tandis que le rôle générique (tous niveaux) passait —
    //    incitation à l'excès de droits.
    //    Inversement, un rôle générique matche aussi un @Roles suffixé.
    const stripSuffix = (r: string) =>
      r.replace(/_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE)$/, '');
    const userBase = stripSuffix(userRole);
    if (userBase !== userRole) {
      // L'utilisateur porte un rôle suffixé → il matche la base requise
      if (requiredRoles.some((r) => stripSuffix(r) === userBase)) {
        return true;
      }
    } else {
      // L'utilisateur porte un rôle générique → il matche un @Roles suffixé de la même base
      if (requiredRoles.some((r) => stripSuffix(r) === userRole)) {
        return true;
      }
    }

    // ⭐ FIX 2026-09-06 — synonymes français/anglais de rôles :
    //    l'enum officiel UserRole (common/enums/user-role.enum.ts) utilise les
    //    libellés FRANÇAIS (PROMOTEUR, DIRECTEUR, SECRETAIRE, COMPTABLE…),
    //    mais plusieurs listes @Roles utilisent les libellés ANGLAIS
    //    (PROMOTER, DIRECTOR, SECRETARY, ACCOUNTANT…). Un compte PROMOTEUR
    //    (libellé officiel) était rejeté 403 sur les endpoints
    //    @Roles('PROMOTER') — y compris POST /students/assign-physical-class,
    //    bloquant de fait le promoteur d'école sur l'onglet Affectations
    //    (constaté en prod CSPEB lors du rattrapage des élèves CP).
    const EN2FR: Record<string, string> = {
      PROMOTER: 'PROMOTEUR',
      DIRECTOR: 'DIRECTEUR',
      SECRETARY: 'SECRETAIRE',
      ACCOUNTANT: 'COMPTABLE',
    };
    const canon = (r: string) => EN2FR[stripSuffix(r)] ?? stripSuffix(r);
    if (requiredRoles.some((r) => canon(r) === canon(userRole))) {
      return true;
    }

    return false;
  }
}
