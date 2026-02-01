/**
 * ============================================================================
 * CONTEXT INTERCEPTOR - RÉSOLUTION ET VALIDATION DU CONTEXTE
 * ============================================================================
 * 
 * Interceptor global qui résout et valide le contexte complet :
 * - tenant_id
 * - school_level_id (OBLIGATOIRE)
 * - module_type (OBLIGATOIRE)
 * 
 * Interdit toute requête ambiguë (sans niveau ou sans module).
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
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { RequestContextService } from '../context/request-context.service';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';

@Injectable()
export class ContextInterceptor implements NestInterceptor {
  constructor(
    private readonly contextService: RequestContextService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
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
    // Ces routes ne nécessitent PAS de contexte complet avant l'authentification
    if (
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/select-tenant') ||
      path.includes('/auth/dev-login') ||
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

    // 🚨 Si le tenant n'est PAS requis → on laisse passer sans résoudre le contexte
    if (!requireTenant) {
      return next.handle();
    }

    // Résoudre et valider le contexte complet (seulement si tenant requis)
    const resolvedContext = await this.contextService.resolveContext(request);

    // Attacher le contexte à la requête
    this.contextService.attachContextToRequest(request, resolvedContext);

    // Forcer l'injection du schoolLevelId dans le body pour CREATE/UPDATE
    if (request.body && typeof request.body === 'object') {
      // Empêcher la modification du schoolLevelId
      if (request.body.schoolLevelId && request.body.schoolLevelId !== resolvedContext.schoolLevelId) {
        throw new BadRequestException(
          'Cannot modify school_level_id in request body. This is a security violation.'
        );
      }
      // Injecter automatiquement si absent
      if (!request.body.schoolLevelId) {
        request.body.schoolLevelId = resolvedContext.schoolLevelId;
      }
    }

    // Forcer l'injection du schoolLevelId dans les query params
    if (request.query) {
      // Empêcher la modification du schoolLevelId
      if (request.query.schoolLevelId && request.query.schoolLevelId !== resolvedContext.schoolLevelId) {
        throw new BadRequestException(
          'Cannot specify different school_level_id in query parameters.'
        );
      }
      // Injecter automatiquement si absent
      if (!request.query.schoolLevelId) {
        request.query.schoolLevelId = resolvedContext.schoolLevelId;
      }
    }

    return next.handle();
  }
}

