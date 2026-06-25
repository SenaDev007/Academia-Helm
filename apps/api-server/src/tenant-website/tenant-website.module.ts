/**
 * ============================================================================
 * TENANT WEBSITE MODULE — CMS pour le site institutionnel des écoles
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { TenantWebsiteController } from './tenant-website.controller';
import { TenantWebsiteService } from './tenant-website.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TenantWebsiteController],
  providers: [TenantWebsiteService],
  exports: [TenantWebsiteService],
})
export class TenantWebsiteModule {}
