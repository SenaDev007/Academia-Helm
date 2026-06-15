/**
 * ============================================================================
 * SECURITY MODULE - MODULE SÉCURITÉ (PLATFORM_OWNER)
 * ============================================================================
 */

import { Module, Global, Controller } from '@nestjs/common';
import { PlatformOwnerService } from './platform-owner.service';
import { PlatformOwnerGuard } from './guards/platform-owner.guard';
import { ContextForcerService } from './services/context-forcer.service';
import { PlatformOwnerContextInterceptor } from './interceptors/platform-owner-context.interceptor';
import { PlatformOwnerAuditExclusionInterceptor } from './interceptors/platform-owner-audit-exclusion.interceptor';
import { PlatformOwnerController } from './controllers/platform-owner.controller';

@Global()
@Module({
  controllers: [PlatformOwnerController],
  providers: [
    PlatformOwnerService,
    PlatformOwnerGuard,
    ContextForcerService,
    PlatformOwnerContextInterceptor,
    PlatformOwnerAuditExclusionInterceptor,
  ],
  exports: [
    PlatformOwnerService,
    PlatformOwnerGuard,
    ContextForcerService,
    PlatformOwnerContextInterceptor,
    PlatformOwnerAuditExclusionInterceptor,
  ],
})
export class SecurityModule {}
