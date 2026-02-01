/**
 * ============================================================================
 * COMMON MODULE - SERVICES ET GUARDS COMMUNS
 * ============================================================================
 */

import { Module, Global, Controller } from '@nestjs/common';
import { PermissionsService } from './services/permissions.service';
import { DashboardService } from './services/dashboard.service';
import { StrictPermissionsService } from './services/strict-permissions.service';
import { AccessDeniedLogService } from './services/access-denied-log.service';
import { SubdomainService } from './services/subdomain.service';
import { PermissionsController } from './controllers/permissions.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { DatabaseModule } from '../database/database.module';
import { SecurityModule } from '../security/security.module';

@Global()
@Module({
  imports: [
    DatabaseModule, // Pour accéder à PrismaService
    SecurityModule, // Pour accéder à PlatformOwnerService
  ],
  controllers: [PermissionsController, DashboardController],
  providers: [
    PermissionsService,
    DashboardService,
    StrictPermissionsService,
    AccessDeniedLogService,
    SubdomainService,
  ],
  exports: [
    PermissionsService,
    DashboardService,
    StrictPermissionsService,
    AccessDeniedLogService,
    SubdomainService,
  ],
})
export class CommonModule {}
