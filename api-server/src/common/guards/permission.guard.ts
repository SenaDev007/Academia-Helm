/**
 * ============================================================================
 * PERMISSION GUARD - RBAC AVANCÉ MULTI-TENANT
 * ============================================================================
 *
 * Ordre de vérification (critique pour la sécurité) :
 * 1. JWT (utilisateur authentifié)
 * 2. Tenant (contexte tenant résolu)
 * 3. Rôle (rôles de l'utilisateur pour ce tenant)
 * 4. Permission (module + action en base)
 * 5. Feature flag (module activé pour le tenant)
 *
 * Utilisation : @UseGuards(JwtAuthGuard, PermissionGuard) + @RequirePermission('FINANCES', 'read')
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RolesPermissionsService } from '../../settings/services/roles-permissions.service';
import { FeatureFlagsService } from '../../settings/services/feature-flags.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';

/** Mapping ressource (permission) → code feature flag pour vérifier que le module est activé */
const MODULE_TO_FEATURE_CODE: Record<string, string> = {
  ELEVES: 'STUDENTS',
  INSCRIPTIONS: 'STUDENTS',
  DOCUMENTS_SCOLAIRES: 'STUDENTS',
  ORGANISATION_PEDAGOGIQUE: 'PEDAGOGY',
  MATERIEL_PEDAGOGIQUE: 'PEDAGOGY',
  EXAMENS: 'EXAMS',
  BULLETINS: 'EXAMS',
  FINANCES: 'FINANCE',
  RECOUVREMENT: 'FINANCE',
  DEPENSES: 'FINANCE',
  RH: 'HR_PAYROLL',
  PAIE: 'HR_PAYROLL',
  COMMUNICATION: 'COMMUNICATION',
  PARAMETRES: 'PARAMETRES',
  ANNEES_SCOLAIRES: 'PARAMETRES',
  ORION: 'ORION',
  ATLAS: 'ATLAS',
  QHSE: 'QHSE',
  BIBLIOTHEQUE: 'LIBRARY',
  TRANSPORT: 'TRANSPORT',
  CANTINE: 'CANTEEN',
  INFIRMERIE: 'INFIRMARY',
  EDUCAST: 'EDUCAST',
  BOUTIQUE: 'SHOP',
};

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rolesPermissionsService: RolesPermissionsService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const meta = this.reflector.getAllAndOverride<{ moduleKey: string; actionKey: string }>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta?.moduleKey || !meta?.actionKey) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as any;
    if (!user?.id) {
      throw new ForbiddenException('Non authentifié');
    }

    // 1. JWT : déjà validé par JwtAuthGuard
    // 2. Tenant (isolation : seul PLATFORM_OWNER peut utiliser query/header pour cross-tenant)
    const tenantId = this.resolveTenantId(request, user);
    if (!tenantId) {
      throw new BadRequestException('Contexte tenant manquant');
    }

    const roleStr = (user.role as string)?.toUpperCase();
    // PLATFORM_OWNER / SUPER_ADMIN : bypass (vision globale)
    if (roleStr === 'PLATFORM_OWNER' || roleStr === 'SUPER_ADMIN' || user.isSuperAdmin) {
      this.logger.debug(`Bypass permission: ${roleStr || 'superAdmin'}`);
      return true;
    }

    // 3. Rôle + 4. Permission (en base)
    const hasPerm = await this.rolesPermissionsService.userHasPermission(
      user.id,
      meta.moduleKey,
      meta.actionKey,
      tenantId,
    );
    if (!hasPerm) {
      this.logger.warn(
        `Permission refusée: user=${user.id} tenant=${tenantId} ${meta.moduleKey}:${meta.actionKey}`,
      );
      throw new ForbiddenException(
        `Accès refusé: permission ${meta.moduleKey}:${meta.actionKey} requise`,
      );
    }

    // 5. Feature flag (module activé pour le tenant)
    const featureCode = MODULE_TO_FEATURE_CODE[meta.moduleKey];
    if (featureCode && featureCode !== 'PARAMETRES') {
      const enabled = await this.featureFlagsService.isFeatureEnabled(tenantId, featureCode);
      if (!enabled) {
        this.logger.warn(`Module désactivé: tenant=${tenantId} feature=${featureCode}`);
        throw new ForbiddenException(`Module ${featureCode} non activé pour cet établissement`);
      }
    }

    return true;
  }

  private resolveTenantId(request: Request, user: any): string | undefined {
    const fromUser =
      typeof user?.tenantId === 'string'
        ? user.tenantId
        : user?.tenantId?.id ?? user?.tenantId?.tenantId;
    const roleStr = (user?.role as string)?.toUpperCase();
    const canCrossTenant = roleStr === 'PLATFORM_OWNER' || roleStr === 'SUPER_ADMIN' || user?.isSuperAdmin === true;
    if (canCrossTenant) {
      const fromReq = request['tenantId'];
      if (fromReq && typeof fromReq === 'string') return fromReq;
      const fromHeader = request.headers['x-tenant-id'];
      const h = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
      if (h) return h;
      const fromQuery = (request as any).query?.tenant_id;
      const q = Array.isArray(fromQuery) ? fromQuery[0] : fromQuery;
      if (q) return q;
    }
    return fromUser ?? undefined;
  }
}
