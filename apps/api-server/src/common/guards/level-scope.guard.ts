import { Injectable, CanActivate, ExecutionContext, Logger, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { AdminStructureService } from '../../admin-structure/admin-structure.service';

/**
 * ============================================================================
 * LevelScopeGuard — Vérifie que l'utilisateur a accès au niveau scolaire actif
 * ============================================================================
 *
 * À utiliser AVEC JwtAuthGuard + TenantGuard (+ RolesGuard si @Roles) :
 *   @UseGuards(JwtAuthGuard, TenantGuard, LevelScopeGuard)
 *
 * Logique :
 *   1. Lit le header `x-school-level-id` (injecté par le frontend)
 *   2. Si pas de header → OK (accès global, ex: super admin, modules transverses)
 *   3. Récupère le rôle de l'utilisateur (User.role)
 *   4. Si le rôle n'a pas de levelScopes (rôle générique type SCHOOL_DIRECTOR,
 *      PROMOTER, etc.) → OK (accès tous niveaux)
 *   5. Si le rôle a des levelScopes :
 *      a. Récupère le code du niveau actif depuis SchoolLevel
 *      b. En mode FUSED_MATERNELLE_PRIMAIRE, étend MATERNELLE ↔ PRIMARY
 *      c. Vérifie que le niveau actif (ou son extension FUSED) est dans levelScopes
 *      d. Si NON → 403 Forbidden
 *
 * Le guard utilise un mapping statique des rôles level-specific (ROLE_LEVEL_SCOPES)
 * pour éviter une dépendance circulaire avec le frontend role-portal-map.
 * ============================================================================
 */

// Mapping statique des rôles level-specific → levelScopes
// (synthone de role-portal-map.ts côté frontend)
const ROLE_LEVEL_SCOPES: Record<string, string[]> = {
  // Rôles existants
  'RESP_MATERNELLE': ['MATERNELLE'],
  'RESP_PRIMAIRE': ['PRIMARY'],
  'RESP_SECONDAIRE': ['SECONDARY'],
  'PEDAGOGIC_COORDINATOR': ['MATERNELLE'],
  'TEACHING_ASSISTANT': ['MATERNELLE'],
  'ACTIVITIES_MANAGER': ['PRIMARY'],
  'CENSOR': ['SECONDARY'],
  'GENERAL_MONITOR': ['SECONDARY'],
  'ORIENTATION_MANAGER': ['SECONDARY'],

  // Nouveaux rôles Phase 2 — Directeurs par niveau
  'DIRECTEUR_MATERNELLE': ['MATERNELLE'],
  'DIRECTEUR_PRIMAIRE': ['PRIMARY'],
  'DIRECTEUR_SECONDAIRE': ['SECONDARY'],
  'DIRECTEUR_MAT_PRI': ['MATERNELLE', 'PRIMARY'], // Mode FUSED

  // Secrétaires par niveau
  'SECRETAIRE_MATERNELLE': ['MATERNELLE'],
  'SECRETAIRE_PRIMAIRE': ['PRIMARY'],
  'SECRETAIRE_SECONDAIRE': ['SECONDARY'],
  'SECRETAIRE_MAT_PRI': ['MATERNELLE', 'PRIMARY'],

  // Secrétaires comptables par niveau
  'SECRETAIRE_COMPTABLE_MATERNELLE': ['MATERNELLE'],
  'SECRETAIRE_COMPTABLE_PRIMAIRE': ['PRIMARY'],
  'SECRETAIRE_COMPTABLE_SECONDAIRE': ['SECONDARY'],
  'SECRETAIRE_COMPTABLE_MAT_PRI': ['MATERNELLE', 'PRIMARY'],
};

// Rôles qui ont accès à TOUS les niveaux (pas de restriction)
const ALL_LEVEL_ROLES = new Set([
  'SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN',
  'PROMOTER', 'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL',
  'SCHOOL_DIRECTOR', 'DEPUTY_DIRECTOR', 'SCHOOL_ADMIN',
  // Rôles transverses (HR, Finance, Communication, etc.)
  'HR_MANAGER', 'PAYROLL_MANAGER', 'ACCOUNTANT', 'CASHIER', 'CFO',
  'FINANCE_MANAGER', 'RECOVERY_MANAGER', 'PEDAGOGIC_DIRECTOR',
  'SCHOOL_LIFE_MANAGER', 'COMMUNICATION_MANAGER', 'IT_MANAGER',
  'LIBRARIAN', 'CANTEEN_MANAGER', 'TRANSPORT_MANAGER', 'BOARDING_MANAGER',
  'HEALTH_MANAGER', 'SECURITY_MANAGER', 'SETTINGS_MANAGER',
  'RESP_SCOLARITE', 'DATA_MANAGER', 'INTERNAL_AUDITOR',
  'EXAM_MANAGER', 'MONITOR', 'ADMIN_AGENT',
]);

@Injectable()
export class LevelScopeGuard implements CanActivate {
  private readonly logger = new Logger(LevelScopeGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly adminStructureService: AdminStructureService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. Lire le header x-school-level-id
    const schoolLevelId = request.headers['x-school-level-id'] as string | undefined;

    // 2. Pas de header → accès global (OK)
    if (!schoolLevelId) {
      return true;
    }

    // 3. Récupérer l'utilisateur
    const user = request.user;
    if (!user) {
      return true; // Si pas d'user, c'est JwtAuthGuard qui gère
    }

    // 4. Récupérer le rôle
    const role = user.role || user.roleType;
    if (!role) {
      return true; // Pas de rôle → pas de restriction (autre guard gère)
    }

    // 5. Rôles ALL_LEVELS → OK
    if (ALL_LEVEL_ROLES.has(role)) {
      return true;
    }

    // 6. Récupérer les levelScopes du rôle
    const levelScopes = ROLE_LEVEL_SCOPES[role];
    if (!levelScopes) {
      // Rôle non listé → pas de restriction (par défaut, on ne bloque pas)
      return true;
    }

    // 7. Récupérer le code du niveau actif depuis la DB
    const tenantId = user.tenantId || request.headers['x-tenant-id'];
    if (!tenantId) {
      return true;
    }

    let activeLevelCode: string;
    try {
      const level = await this.prisma.schoolLevel.findUnique({
        where: { id: schoolLevelId },
        select: { code: true, tenantId: true },
      });

      if (!level || level.tenantId !== tenantId) {
        // Niveau introuvable ou n'appartient pas au tenant → on laisse passer
        // (c'est probablement une requête transverse)
        return true;
      }

      activeLevelCode = level.code;
    } catch (err: any) {
      this.logger.warn(`Failed to fetch school level ${schoolLevelId}: ${err.message}`);
      return true; // En cas d'erreur DB, on ne bloque pas (fail-open)
    }

    // 8. En mode FUSED, étendre MATERNELLE ↔ PRIMARY
    const resolvedLevels = await this.adminStructureService.resolveAdminLevelsForUser(
      tenantId,
      activeLevelCode,
    );

    // 9. Vérifier qu'au moins un niveau résolu est dans levelScopes
    const hasAccess = resolvedLevels.some((level) => levelScopes.includes(level));

    if (!hasAccess) {
      this.logger.warn(
        `Access denied: role=${role}, activeLevel=${activeLevelCode}, ` +
        `resolvedLevels=${resolvedLevels.join(',')}, levelScopes=${levelScopes.join(',')}`,
      );
      throw new ForbiddenException(
        `Votre rôle (${role}) n'a pas accès au niveau ${activeLevelCode}. ` +
        `Niveaux autorisés : ${levelScopes.join(', ')}`,
      );
    }

    return true;
  }
}
