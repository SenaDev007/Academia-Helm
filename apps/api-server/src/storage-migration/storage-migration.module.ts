/**
 * StorageMigrationModule — auto-registration de StorageMigrationService
 *
 * Ce module est importé dans AppModule pour déclencher l'auto-migration
 * au démarrage de l'application, sans intervention manuelle.
 *
 * ⚠️ StorageService est fourni par CommonModule (qui est @Global()).
 * Ne PAS le redéclarer ici — cela créerait une 2e instance et causerait
 * des conflits DI.
 */

import { Module } from '@nestjs/common';
import { StorageMigrationService } from './storage-migration.service';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [StorageMigrationService],
  exports: [StorageMigrationService],
})
export class StorageMigrationModule {}
