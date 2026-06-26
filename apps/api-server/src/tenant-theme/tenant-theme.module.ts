import { Module } from '@nestjs/common';
import { TenantThemeController } from './tenant-theme.controller';
import { TenantThemeService } from './tenant-theme.service';

/**
 * TenantThemeModule — Gestion du thème du site institutionnel tenant
 */
@Module({
  controllers: [TenantThemeController],
  providers: [TenantThemeService],
  exports: [TenantThemeService],
})
export class TenantThemeModule {}
