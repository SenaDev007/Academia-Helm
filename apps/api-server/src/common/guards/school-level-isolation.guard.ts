/**
 * ============================================================================
 * SCHOOL LEVEL ISOLATION GUARD - RÈGLE STRUCTURANTE NON NÉGOCIABLE
 * ============================================================================
 * 
 * RÈGLE FONDAMENTALE :
 * Les niveaux scolaires (Maternelle, Primaire, Secondaire) sont des
 * DOMAINES MÉTIER AUTONOMES qui ne doivent JAMAIS être mélangés.
 * 
 * Ce guard garantit que :
 * - Toute requête métier DOIT avoir un school_level_id explicite
 * - Aucune requête cross-niveau n'est autorisée
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
import { AuditLogsService } from '../../audit-logs/audit-logs.service';

@Injectable()
export class SchoolLevelIsolationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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

    // Vérifier si cross-level est explicitement autorisé (Module Général uniquement)
    const allowCrossLevel = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const user = request['user'] as any;
    const tenantId = request['tenantId'] || user?.tenantId;
    const userId = user?.id;

    // RÈGLE 1 : school_level_id est OBLIGATOIRE pour toutes les opérations métier
    const schoolLevelId = this.extractSchoolLevelId(request);

    if (!schoolLevelId && !allowCrossLevel) {
      // Journaliser la tentative de violation (via console pour éviter dépendance circulaire)
      if (tenantId && userId) {
        console.warn('SCHOOL_LEVEL_VIOLATION_ATTEMPT', {
          tenantId,
          userId,
          endpoint: request.url,
          method: request.method,
          reason: 'Missing school_level_id',
        });
      }

      throw new BadRequestException(
        'SCHOOL LEVEL ISOLATION RULE VIOLATION: ' +
        'School Level ID is MANDATORY for all business operations. ' +
        'Maternelle, Primaire, and Secondaire are AUTONOMOUS business domains ' +
        'that must NEVER be mixed. ' +
        'Please provide X-School-Level-ID header or schoolLevelId parameter.'
      );
    }

    // RÈGLE 2 : Empêcher les tentatives de mélange de niveaux
    if (schoolLevelId && request.body?.schoolLevelId && request.body.schoolLevelId !== schoolLevelId) {
      // Journaliser la tentative de violation (via console pour éviter dépendance circulaire)
      if (tenantId && userId) {
        console.warn('SCHOOL_LEVEL_MIXING_ATTEMPT', {
          tenantId,
          userId,
          endpoint: request.url,
          method: request.method,
          providedLevel: schoolLevelId,
          attemptedLevel: request.body.schoolLevelId,
          reason: 'Attempted to mix school levels',
        });
      }

      throw new ForbiddenException(
        'SCHOOL LEVEL ISOLATION RULE VIOLATION: ' +
        'Cannot mix school levels. The provided school_level_id in the request body ' +
        `(${request.body.schoolLevelId}) does not match the context school_level_id (${schoolLevelId}). ` +
        'Each school level is an autonomous domain and data must never be mixed.'
      );
    }

    // RÈGLE 3 : Vérifier que les query params ne tentent pas de mélanger
    if (schoolLevelId && request.query?.schoolLevelId && request.query.schoolLevelId !== schoolLevelId) {
      throw new ForbiddenException(
        'SCHOOL LEVEL ISOLATION RULE VIOLATION: ' +
        'Cannot specify a different school_level_id in query parameters. ' +
        'All operations must be scoped to a single school level.'
      );
    }

    // RÈGLE 4 : Si cross-level autorisé, vérifier que c'est pour le Module Général uniquement
    if (allowCrossLevel) {
      const moduleType = request['moduleType'] || request.headers['x-module-type'];
      if (moduleType !== 'SYNTHESIS' && moduleType !== 'GENERAL') {
        throw new ForbiddenException(
          'Cross-level operations are only allowed for the General/Synthesis module. ' +
          'This endpoint does not have the required authorization.'
        );
      }
    }

    return true;
  }

  private extractSchoolLevelId(request: Request): string | null {
    // Priorité 1 : Depuis le contexte résolu
    if (request['context']?.schoolLevelId) {
      return request['context'].schoolLevelId;
    }

    // Priorité 2 : Depuis request.schoolLevelId (déjà résolu)
    if (request['schoolLevelId']) {
      return request['schoolLevelId'];
    }

    // Priorité 3 : Depuis les headers
    if (request.headers['x-school-level-id']) {
      return request.headers['x-school-level-id'] as string;
    }

    // Priorité 4 : Depuis query params
    if (request.query?.schoolLevelId) {
      return request.query.schoolLevelId as string;
    }

    // Priorité 5 : Depuis body
    if (request.body?.schoolLevelId) {
      return request.body.schoolLevelId;
    }

    return null;
  }
}

