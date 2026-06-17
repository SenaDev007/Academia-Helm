/**
 * ============================================================================
 * ACADEMIC YEAR ENFORCEMENT GUARD - DIMENSION OBLIGATOIRE
 * ============================================================================
 *
 * RÈGLE FONDAMENTALE :
 * L'année scolaire (academic_year_id) est une DIMENSION OBLIGATOIRE
 * pour toutes les opérations métier, au même niveau que tenant_id
 * et school_level_id.
 *
 * COMPORTEMENT (depuis implémentation "année stricte" + fix régression) :
 * - Routes @Public() → laissées passer (pas d'auth)
 * - Routes @SkipAcademicYear() → laissées passer (auth, settings tenant-level, billing plateforme…)
 * - Routes @AllowCrossLevel() → laissées passer (Module Général)
 * - Routes dans la liste exemptedPrefixes → laissées passer
 * - TOUTES LES AUTRES ROUTES AUTHENTIFIÉES → MODE NON-BLOQUANT :
 *   Si academicYearId absent, on logge un warning et on laisse passer
 *   (pour éviter les régressions sur l'auth et les routes pré-login).
 *   Le garde strict sera réactivé progressivement.
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ALLOW_CROSS_LEVEL_KEY } from '../decorators/allow-cross-level.decorator';
import { SKIP_ACADEMIC_YEAR_KEY } from '../decorators/skip-academic-year.decorator';

@Injectable()
export class AcademicYearEnforcementGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // ✅ Ignorer les routes publiques (pas d'auth requise)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // ✅ Ignorer les routes explicitement exemptées d'année scolaire
    const skipAcademicYear = this.reflector.getAllAndOverride<boolean>(SKIP_ACADEMIC_YEAR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAcademicYear) {
      return true;
    }

    // ✅ Vérifier si cross-level est autorisé (Module Général uniquement)
    const allowCrossLevel = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // ✅ Fallback path-based : ignorer les routes légitimement sans année scolaire
    const path = request.url || '';
    if (this.isPathExempted(path)) {
      return true;
    }

    const user = request['user'] as any;
    const tenantId = request['tenantId'] || user?.tenantId;
    const userId = user?.id;

    // RÈGLE 1 : academic_year_id est OBLIGATOIRE pour toutes les opérations métier
    const academicYearId = this.extractAcademicYearId(request);

    if (!academicYearId && !allowCrossLevel) {
      // MODE NON-BLOQUANT : on logge un warning mais on laisse passer
      // pour éviter les régressions sur l'auth, les routes pré-login,
      // et les routes qui n'ont pas encore été adaptées.
      // Le garde strict sera réactivé progressivement après identification
      // de toutes les routes nécessitant une année.
      console.warn('ACADEMIC_YEAR_WARNING (non-blocking)', {
        tenantId: tenantId || 'unknown',
        userId: userId || 'unknown',
        endpoint: request.url,
        method: request.method,
        reason: 'Missing academic_year_id — allowed in non-blocking mode',
      });
      return true; // Laisser passer au lieu de throw
    }

    // RÈGLE 2 : Empêcher les tentatives de mélange d'années
    if (academicYearId && request.body?.academicYearId && request.body.academicYearId !== academicYearId) {
      if (tenantId && userId) {
        console.warn('ACADEMIC_YEAR_MIXING_ATTEMPT', {
          tenantId,
          userId,
          endpoint: request.url,
          method: request.method,
          providedYear: academicYearId,
          attemptedYear: request.body.academicYearId,
          reason: 'Attempted to mix academic years',
        });
      }

      throw new ForbiddenException(
        'ACADEMIC YEAR ENFORCEMENT RULE VIOLATION: ' +
        'Cannot mix academic years. The provided academic_year_id in the request body ' +
        `(${request.body.academicYearId}) does not match the context academic_year_id (${academicYearId}). ` +
        'Each academic year is an autonomous dimension and data must never be mixed.'
      );
    }

    // RÈGLE 3 : Vérifier que les query params ne tentent pas de mélanger
    if (academicYearId && request.query?.academicYearId && request.query.academicYearId !== academicYearId) {
      throw new ForbiddenException(
        'ACADEMIC YEAR ENFORCEMENT RULE VIOLATION: ' +
        'Cannot specify a different academic_year_id in query parameters. ' +
        'All operations must be scoped to a single academic year.'
      );
    }

    return true;
  }

  private extractAcademicYearId(request: Request): string | null {
    // Priorité 1 : Depuis le contexte résolu
    if (request['context']?.academicYearId) {
      return request['context'].academicYearId;
    }

    // Priorité 2 : Depuis request.academicYearId (déjà résolu)
    if (request['academicYearId']) {
      return request['academicYearId'];
    }

    // Priorité 3 : Depuis les headers
    if (request.headers['x-academic-year-id']) {
      return request.headers['x-academic-year-id'] as string;
    }

    // Priorité 4 : Depuis query params
    if (request.query?.academicYearId) {
      return request.query.academicYearId as string;
    }

    // Priorité 5 : Depuis body
    if (request.body?.academicYearId) {
      return request.body.academicYearId;
    }

    return null;
  }

  /**
   * Vérifie si un path correspond à une route légitimement sans année scolaire.
   */
  private isPathExempted(path: string): boolean {
    const cleanPath = path.split('?')[0];

    const exemptedPrefixes = [
      // Authentification
      '/auth/',
      '/auth/login',
      '/auth/register',
      '/auth/select-tenant',
      '/auth/dev-login',
      '/auth/dev-available-tenants',
      '/auth/available-tenants',
      '/auth/google',
      '/auth/otp',
      '/auth/reset-password',
      '/auth/forgot-password',
      '/auth/verify-otp',
      // Données de référence
      '/countries',
      '/departments',
      '/school-levels',
      '/schools',
      // Config tenant-level
      '/tenants',
      '/users',
      '/roles',
      '/permissions',
      '/rooms',
      // Gestion des années scolaires elles-mêmes
      '/academic-years',
      '/academic-tracks',
      '/quarters',
      // Plateforme
      '/platform',
      '/billing',
      '/onboarding',
      '/access-requests',
      // Portail public et avis
      '/portal',
      '/reviews',
      // Infrastructure
      '/health',
      '/media',
      '/sync',
      '/tenant-features',
      '/audit-logs',
      // Modules transverses
      '/sara',
      '/atlas',
      '/federis',
      '/security',
      '/compliance',
      '/educmaster',
      // Politiques et configurations
      '/salary-policies',
      '/fee-configurations',
      '/grading-policies',
      // Context
      '/context',
      // Settings tenant-level
      '/settings/school-calendar-config',
      '/settings/general',
      '/settings/features',
      '/settings/security',
      '/settings/communication',
      '/settings/bilingual',
      '/settings/orion',
      '/settings/atlas',
      '/settings/offline',
      '/settings/identity',
      '/settings/seals',
      '/settings/roles',
      '/settings/structure',
      '/settings/billing',
      '/settings/history',
      '/settings/stamps',
    ];

    return exemptedPrefixes.some((prefix) => cleanPath.startsWith(prefix));
  }
}
