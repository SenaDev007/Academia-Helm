import { Module } from '@nestjs/common';
import { AdminStructureController } from './admin-structure.controller';
import { AdminStructureService } from './admin-structure.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

/**
 * AdminStructureModule — Gestion du mode d'administration scolaire
 *
 * SEPARATE : chaque niveau a sa propre administration
 * FUSED_MATERNELLE_PRIMAIRE : maternelle+primaire fusionnés, secondaire séparé
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AdminStructureController],
  providers: [AdminStructureService],
  exports: [AdminStructureService],
})
export class AdminStructureModule {}
