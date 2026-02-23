/**
 * ============================================================================
 * SCHOOL LEVEL ENFORCEMENT INTERCEPTOR
 * ============================================================================
 * 
 * Interceptor qui FORCE l'injection de school_level_id dans toutes les
 * requêtes métier et empêche toute tentative de mélange.
 * 
 * RÈGLES APPLIQUÉES :
 * 1. Force school_level_id dans toutes les requêtes
 * 2. Empêche la modification de school_level_id
 * 3. Bloque les tentatives de mélange
 * 4. Journalise les violations
 * 
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { ALLOW_CROSS_LEVEL_KEY } from '../decorators/allow-cross-level.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';

@Injectable()
export class SchoolLevelEnforcementInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.url || request.route?.path || '';

    // ✅ Ignorer les routes publiques
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return next.handle();
    }

    // ✅ Exclure explicitement les routes d'authentification et de portail
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/select-tenant') ||
      path.includes('/auth/dev-login') ||
      path.includes('/auth/dev-available-tenants') ||
      path.includes('/auth/available-tenants') ||
      path.includes('/portal/auth') ||
      path.includes('/portal/search') ||
      path.includes('/portal/list') ||
      path.includes('/public/schools')
    ) {
      return next.handle();
    }

    // ✅ Vérifier si le tenant est requis pour cette route
    const requireTenant = this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 🚨 Si le tenant n'est PAS requis → on laisse passer
    if (!requireTenant) {
      return next.handle();
    }

    // Ignorer si cross-level autorisé (Module Général uniquement)
    const allowCrossLevel = this.reflector.getAllAndOverride<boolean>(ALLOW_CROSS_LEVEL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (allowCrossLevel) {
      return next.handle();
    }

    // RÈGLE 1 : Extraire le school_level_id du contexte
    const schoolLevelId = this.extractSchoolLevelId(request);

    if (!schoolLevelId) {
      throw new BadRequestException(
        'SCHOOL LEVEL ISOLATION RULE: ' +
        'School Level ID is mandatory. All business operations must be scoped to a school level.'
      );
    }

    // RÈGLE 2 : Forcer school_level_id dans le body pour CREATE/UPDATE
    if (request.body && typeof request.body === 'object') {
      // Empêcher la modification du school_level_id
      if (request.body.schoolLevelId && request.body.schoolLevelId !== schoolLevelId) {
        throw new BadRequestException(
          'SCHOOL LEVEL ISOLATION RULE: ' +
          `Cannot change school_level_id. Expected ${schoolLevelId}, got ${request.body.schoolLevelId}. ` +
          'Each school level is an autonomous domain.'
        );
      }

      // Forcer l'injection si absent
      if (!request.body.schoolLevelId) {
        request.body.schoolLevelId = schoolLevelId;
      }
    }

    // RÈGLE 3 : Forcer school_level_id dans les query params
    if (request.query && typeof request.query === 'object') {
      // Empêcher la modification du school_level_id
      if (request.query.schoolLevelId && request.query.schoolLevelId !== schoolLevelId) {
        throw new BadRequestException(
          'SCHOOL LEVEL ISOLATION RULE: ' +
          `Cannot specify different school_level_id in query. Expected ${schoolLevelId}.`
        );
      }

      // Forcer l'injection si absent
      if (!request.query.schoolLevelId) {
        request.query.schoolLevelId = schoolLevelId;
      }
    }

    // RÈGLE 4 : Stocker dans request pour accès facile
    request['schoolLevelId'] = schoolLevelId;

    return next.handle();
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

