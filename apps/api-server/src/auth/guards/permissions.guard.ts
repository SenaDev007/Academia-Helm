/**
 * ============================================================================
 * PERMISSIONS GUARD - RBAC STRICT
 * ============================================================================
 * 
 * Guard pour vérifier que l'utilisateur a toutes les permissions requises
 * Utilise les permissions déjà extraites par JwtStrategy (dans request.user.permissions)
 * au lieu de refaire une requête DB à chaque vérification.
 * 
 * v2: Optimisation — utilise user.permissions du JWT (extrait par JwtStrategy)
 *     au lieu de re-interroger la DB pour chaque guard.
 * ============================================================================
 */

import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    // ⭐ PROMOTER, DIRECTOR, ADMIN = accès total (propriétaires/direction de l'école)
    // Ces rôles ont tous les droits sur leur établissement.
    // ⭐ V10e — Même pattern que portal-auth.service : couvre les variantes FR
    // (DIRECTEUR_MAT_PRI, DIRECTEUR_MATERNELLE, DIRECTEUR_SECONDAIRE…), les
    // suffixes de niveau (_MAT, _PRI, _SEC…) et les rôles d'administration
    // (SURVEILLANT_GENERAL, CENSEUR, SECRETAIRE, COMPTABLE…). Avant, seul le
    // rôle exact 'DIRECTOR' passait → un DIRECTEUR_MAT_PRI sans user_roles
    // en base recevait 403 « Missing permissions: exams.read ».
    const bypassRoles = ['PROMOTER', 'DIRECTOR', 'ADMIN', 'SUPER_ADMIN'];
    const adminRolePattern =
      /^(PROMOTEUR|PROMOTER|DIRECTEUR|SECRETAIRE_COMPTABLE|SECRETAIRE|COMPTABLE|SURVEILLANT_GENERAL|SURVEILLANT|CENSEUR|DIRECTOR|SUPER_DIRECTOR|ADMIN|ACCOUNTANT|SCHOOL_OWNER|SCHOOL_ADMIN|DIRECTEUR_GENERAL|DIRECTEUR_ETABLISSEMENT|DIRECTEUR_ADJOINT|DIRECTEUR_DES_ETUDES)(_(MAT|PRI|SEC|MAT_PRI|MATERNELLE|PRIMAIRE|SECONDAIRE))?$/;
    const roleUpper = (user.role || '').toUpperCase();
    if (bypassRoles.includes(user.role) || adminRolePattern.test(roleUpper)) {
      return true;
    }

    // ⭐ Les enseignants ont accès en lecture aux évaluations (exams.read)
    // et peuvent saisir des notes (exams.manage) — ils ne voient que leurs
    // propres évaluations (filtrage par teacherId côté service).
    const teacherRoles = ['TEACHER', 'TEACHER_RESP', 'ENSEIGNANT', 'teacher'];
    if (teacherRoles.includes(user.role) &&
        requiredPermissions.every(p => p === 'exams.read' || p === 'exams.manage')) {
      return true;
    }

    // Use permissions already extracted by JwtStrategy (cached with user) — no DB query needed
    const userPermissions: Set<string> = new Set(user.permissions || []);

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
  }
}
