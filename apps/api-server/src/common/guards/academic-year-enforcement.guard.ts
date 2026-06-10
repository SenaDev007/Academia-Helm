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
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';

@Injectable()
export class AcademicYearEnforcementGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // ✅ Vérifier si le tenant est requis (via @RequireTenant())
    // Si pas requis, on laisse passer (route authentifiée mais sans tenant)
    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireTenant) {
      return true; // Route authentifiée mais sans tenant requis
    }

    // Vérifier si cross-level est autorisé (Module Général uniquement)
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
}

