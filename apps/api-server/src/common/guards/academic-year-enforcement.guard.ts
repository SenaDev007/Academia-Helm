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
 * Ce guard garantit que :
 * - Toute requête métier DOIT avoir un academic_year_id explicite
 * - Une seule année active par tenant
 * - Aucune donnée métier sans contexte d'année scolaire
 * - Toute tentative de contournement est bloquée et loggée
 *
 * COMPORTEMENT (depuis implémentation "année stricte") :
 * - Routes @Public() → laissées passer (pas d'auth)
 * - Routes @AllowCrossLevel() → laissées passer (Module Général, cross-année)
 * - Routes @SkipAcademicYear() → laissées passer (auth, settings tenant-level, billing plateforme…)
 * - TOUTES LES AUTRES ROUTES AUTHENTIFIÉES → academicYearId OBLIGATOIRE
 *
 * ⚠️ Si une route métier légitimement sans année est identifiée, marquez-la
 * explicitement avec @SkipAcademicYear() — ne supprimez PAS ce guard.
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
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
    // (auth, settings tenant-level, billing plateforme, etc.)
    const skipAcademicYear = this.reflector.getAllAndOverride<boolean>(SKIP_ACADEMIC_YEAR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAcademicYear) {
      return true;
    }

    // ✅ Fallback path-based : ignorer les routes légitimement sans année scolaire
    // (données de référence, config tenant-level, auth, plateforme, portail public…)
    // Ceci évite d'avoir à poser @SkipAcademicYear() sur 30+ contrôleurs.
    const path = request.url || '';
    if (this.isPathExempted(path)) {
      return true;
    }

    // ✅ Vérifier si cross-level est autorisé (Module Général uniquement)
    const allowCrossLevel = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const user = request['user'] as any;
    const tenantId = request['tenantId'] || user?.tenantId;
    const userId = user?.id;

    // RÈGLE 1 : academic_year_id est OBLIGATOIRE pour toutes les opérations métier
    const academicYearId = this.extractAcademicYearId(request);

    if (!academicYearId && !allowCrossLevel) {
      // Journaliser la tentative de violation
      if (tenantId && userId) {
        console.warn('ACADEMIC_YEAR_VIOLATION_ATTEMPT', {
          tenantId,
          userId,
          endpoint: request.url,
          method: request.method,
          reason: 'Missing academic_year_id',
        });
      }

      throw new BadRequestException(
        'ACADEMIC YEAR ENFORCEMENT RULE VIOLATION: ' +
        'Academic Year ID is MANDATORY for all business operations. ' +
        'All business data must be scoped to an academic year. ' +
        'Please provide X-Academic-Year-ID header or academicYearId parameter.'
      );
    }

    // RÈGLE 2 : Empêcher les tentatives de mélange d'années
    if (academicYearId && request.body?.academicYearId && request.body.academicYearId !== academicYearId) {
      // Journaliser la tentative de violation
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
   *
   * Ces routes sont :
   * - Authentification (login, register, OTP, password reset, Google OAuth)
   * - Données de référence (countries, departments, school-levels, schools)
   * - Config tenant-level (tenants, users, roles, permissions, rooms)
   * - Gestion des années scolaires elles-mêmes (academic-years, academic-tracks)
   * - Plateforme (billing, onboarding, platform back-office, access-requests)
   * - Portail public (portal, reviews)
   * - Infrastructure (health, media, sync, tenant-features, audit-logs)
   * - Modules transverses (sara, atlas, federis, security, compliance, educmaster)
   * - Politiques/configurations (salary-policies, fee-configurations, grading-policies)
   *
   * ⚠️ Si une route métier légitimement sans année est identifiée plus tard,
   * ajoutez son prefix ici ou marquez le contrôleur avec @SkipAcademicYear().
   */
  private isPathExempted(path: string): boolean {
    // Normaliser le path (enlever query string)
    const cleanPath = path.split('?')[0];

    // Liste des prefixes de routes légitimement sans année scolaire
    const exemptedPrefixes = [
      // Authentification
      '/auth/',
      // Données de référence (pays, départements, niveaux, écoles)
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
      // Plateforme (back-office global, billing, onboarding)
      '/platform',
      '/billing',
      '/onboarding',
      '/access-requests',
      // Portail public et avis
      '/portal',
      '/reviews',
      // Infrastructure et santé
      '/health',
      '/media',
      '/sync',
      '/tenant-features',
      '/audit-logs',
      // Modules transverses (chatbots IA, réseau d'écoles, sécurité)
      '/sara',
      '/atlas',
      '/federis',
      '/security',
      '/compliance',
      '/educmaster',
      // Politiques et configurations (pas liées à une année)
      '/salary-policies',
      '/fee-configurations',
      '/grading-policies',
      // Settings (config tenant-level — mais les academic-years au sein de settings
      // peuvent avoir besoin d'année, ce sera géré au niveau du endpoint)
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

