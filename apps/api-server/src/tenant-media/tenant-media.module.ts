import { Module } from '@nestjs/common';
import { TenantMediaController } from './tenant-media.controller';
import { TenantMediaService } from './tenant-media.service';
import { StorageService } from '../common/services/storage.service';
import { ImageOptimizationService } from '../media/image-optimization.service';

/**
 * TenantMediaModule — Bibliothèque médias tenant-scoped
 *
 * Réutilise StorageService (common) et ImageOptimizationService (media module).
 */
@Module({
  controllers: [TenantMediaController],
  providers: [TenantMediaService, StorageService, ImageOptimizationService],
  exports: [TenantMediaService],
})
export class TenantMediaModule {}
