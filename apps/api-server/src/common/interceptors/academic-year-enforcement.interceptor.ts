/**
 * ============================================================================
 * ACADEMIC YEAR ENFORCEMENT INTERCEPTOR
 * ============================================================================
 *
 * Interceptor qui FORCE l'injection de academic_year_id dans toutes les
 * requêtes métier et empêche toute tentative de mélange.
 *
 * COMPORTEMENT (depuis fix régression) :
 * - Routes @Public() → laissées passer
 * - Routes @SkipAcademicYear() → laissées passer
 * - Routes @AllowCrossLevel() → laissées passer
 * - Routes d'auth/portail explicitement exclues → laissées passer
 * - TOUTES LES AUTRES → MODE NON-BLOQUANT :
 *   Si academicYearId absent, on laisse passer (warning loggé).
 *   Si academicYearId présent, on l'injecte dans body/query.
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { ALLOW_CROSS_LEVEL_KEY } from '../decorators/allow-cross-level.decorator';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { SKIP_ACADEMIC_YEAR_KEY } from '../decorators/skip-academic-year.decorator';

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

    // ✅ Ignorer les routes explicitement exemptées d'année scolaire
    const skipAcademicYear = this.reflector.getAllAndOverride<boolean>(SKIP_ACADEMIC_YEAR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAcademicYear) {
      return next.handle();
    }

    // ✅ Exclure explicitement les routes d'authentification et de portail
    if (this.isPathExempted(path)) {
      return next.handle();
    }

    // ✅ Ignorer si cross-level autorisé (Module Général uniquement)
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
      // MODE NON-BLOQUANT : laisser passer sans academicYearId
      // (pour éviter les régressions sur l'auth et les routes pré-login)
      console.warn('ACADEMIC_YEAR_INTERCEPTOR_WARNING (non-blocking)', {
        endpoint: path,
        method: request.method,
        reason: 'Missing academic_year_id — request allowed without injection',
      });
      return next.handle();
    }

    // RÈGLE 2 : Forcer academic_year_id dans le body pour CREATE/UPDATE
    if (request.body && typeof request.body === 'object') {
      if (request.body.academicYearId && request.body.academicYearId !== academicYearId) {
        // Empêcher la modification du academic_year_id
        throw new Error(
          'ACADEMIC YEAR ENFORCEMENT RULE: ' +
          `Cannot change academic_year_id. Expected ${academicYearId}, got ${request.body.academicYearId}.`
        );
      }

      // Forcer l'injection si absent
      if (!request.body.academicYearId) {
        request.body.academicYearId = academicYearId;
      }
    }

    // RÈGLE 3 : Forcer academic_year_id dans les query params
    if (request.query && typeof request.query === 'object') {
      if (request.query.academicYearId && request.query.academicYearId !== academicYearId) {
        throw new Error(
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
    if (request['context']?.academicYearId) {
      return request['context'].academicYearId;
    }
    if (request['academicYearId']) {
      return request['academicYearId'];
    }
    if (request.headers['x-academic-year-id']) {
      return request.headers['x-academic-year-id'] as string;
    }
    if (request.query?.academicYearId) {
      return request.query.academicYearId as string;
    }
    if (request.body?.academicYearId) {
      return request.body.academicYearId;
    }
    return null;
  }

  /**
   * Vérifie si un path correspond à une route légitimement sans année scolaire.
   * (Même liste que le guard — maintenu en synchronisation)
   */
  private isPathExempted(path: string): boolean {
    const cleanPath = path.split('?')[0];
    const exemptedPrefixes = [
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
      '/countries',
      '/departments',
      '/school-levels',
      '/schools',
      '/tenants',
      '/users',
      '/roles',
      '/permissions',
      '/rooms',
      '/academic-years',
      '/academic-tracks',
      '/quarters',
      '/platform',
      '/billing',
      '/onboarding',
      '/access-requests',
      '/portal',
      '/reviews',
      '/health',
      '/media',
      '/sync',
      '/tenant-features',
      '/audit-logs',
      '/sara',
      '/atlas',
      '/federis',
      '/security',
      '/compliance',
      '/educmaster',
      '/salary-policies',
      '/fee-configurations',
      '/grading-policies',
      '/context',
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
