/**
 * ============================================================================
 * PLATFORM OWNER AUDIT EXCLUSION INTERCEPTOR - EXCLURE DES AUDITS (DEV ONLY)
 * ============================================================================
 * 
 * Exclut le PLATFORM_OWNER des audits métier.
 * 
 * ⚠️ Le PLATFORM_OWNER n'apparaît pas dans les logs métier
 * ⚠️ Aucune trace dans les audits
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
import { PlatformOwnerService } from '../platform-owner.service';

@Injectable()
export class PlatformOwnerAuditExclusionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PlatformOwnerAuditExclusionInterceptor.name);

  constructor(private readonly platformOwnerService: PlatformOwnerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && this.platformOwnerService.isPlatformOwner(user)) {
      // Marquer la requête pour exclusion des audits
      request.skipAudit = true;
      this.logger.debug(`🔐 PLATFORM_OWNER audit excluded`);
    }

    return next.handle();
  }
}
