/**
 * StorageMigrationModule — auto-registration de StorageMigrationService
 *
 * Ce module est importé dans AppModule pour déclencher l'auto-migration
 * au démarrage de l'application, sans intervention manuelle.
 */

import { Module } from '@nestjs/common';
import { StorageMigrationService } from './storage-migration.service';
import { PrismaModule } from '../database/prisma.module';
import { StorageService } from '../common/services/storage.service';

@Module({
  imports: [PrismaModule],
  providers: [StorageMigrationService, StorageService],
  exports: [StorageMigrationService],
})
export class StorageMigrationModule {}
