/**
 * ============================================================================
 * ACADEMIC YEAR ENFORCEMENT INTERCEPTOR
 * ============================================================================
 * 
 * Interceptor qui FORCE l'injection de academic_year_id dans toutes les
 * requêtes métier et empêche toute tentative de mélange.
 * 
 * RÈGLES APPLIQUÉES :
 * 1. Force academic_year_id dans toutes les requêtes
 * 2. Empêche la modification de academic_year_id
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
export class AcademicYearEnforcementInterceptor implements NestInterceptor {
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

    // RÈGLE 1 : Extraire le academic_year_id du contexte
    const academicYearId = this.extractAcademicYearId(request);

    if (!academicYearId) {
      throw new BadRequestException(
        'ACADEMIC YEAR ENFORCEMENT RULE: ' +
        'Academic Year ID is mandatory. All business operations must be scoped to an academic year.'
      );
    }

    // RÈGLE 2 : Forcer academic_year_id dans le body pour CREATE/UPDATE
    if (request.body && typeof request.body === 'object') {
      // Empêcher la modification du academic_year_id
      if (request.body.academicYearId && request.body.academicYearId !== academicYearId) {
        throw new BadRequestException(
          'ACADEMIC YEAR ENFORCEMENT RULE: ' +
          `Cannot change academic_year_id. Expected ${academicYearId}, got ${request.body.academicYearId}. ` +
          'Each academic year is an autonomous dimension.'
        );
      }

      // Forcer l'injection si absent
      if (!request.body.academicYearId) {
        request.body.academicYearId = academicYearId;
      }
    }

    // RÈGLE 3 : Forcer academic_year_id dans les query params
    if (request.query && typeof request.query === 'object') {
      // Empêcher la modification du academic_year_id
      if (request.query.academicYearId && request.query.academicYearId !== academicYearId) {
        throw new BadRequestException(
          'ACADEMIC YEAR ENFORCEMENT RULE: ' +
          `Cannot specify different academic_year_id in query. Expected ${academicYearId}.`
        );
      }

      // Forcer l'injection si absent
      if (!request.query.academicYearId) {
        request.query.academicYearId = academicYearId;
      }
    }

    // RÈGLE 4 : Stocker dans request pour accès facile
    request['academicYearId'] = academicYearId;

    return next.handle();
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

