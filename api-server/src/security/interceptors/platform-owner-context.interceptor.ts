/**
 * ============================================================================
 * PLATFORM OWNER CONTEXT INTERCEPTOR - FORÇAGE CONTEXTE (DEV ONLY)
 * ============================================================================
 * 
 * Intercepte les requêtes du PLATFORM_OWNER et force le contexte
 * depuis les headers HTTP.
 * 
 * ⚠️ Uniquement en development
 * 
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ContextForcerService } from '../services/context-forcer.service';

@Injectable()
export class PlatformOwnerContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PlatformOwnerContextInterceptor.name);

  constructor(private readonly contextForcerService: ContextForcerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    // Forcer le contexte si PLATFORM_OWNER
    const forcedContext = this.contextForcerService.resolveContext(
      user,
      request.headers,
    );

    if (forcedContext) {
      // Injecter le contexte forcé dans la requête
      request.forcedContext = forcedContext;

      // Overrider les valeurs existantes
      if (forcedContext.tenantId) {
        request.user.tenantId = forcedContext.tenantId;
      }
      if (forcedContext.academicYearId) {
        request.user.academicYearId = forcedContext.academicYearId;
      }
      if (forcedContext.schoolLevelId) {
        request.user.schoolLevelId = forcedContext.schoolLevelId;
      }
      if (forcedContext.classId) {
        request.user.classId = forcedContext.classId;
      }

      this.logger.debug(
        `🔐 PLATFORM_OWNER context forced: ${JSON.stringify(forcedContext)}`,
      );
    }

    return next.handle();
  }
}
