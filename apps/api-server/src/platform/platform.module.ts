/**
 * PlatformModule — Back-office Academia Helm (admin.academiahelm.com)
 *
 * Module dédié aux endpoints /platform/* qui alimentent les modules du
 * back-office centralisé. Aucune donnée mock — tout vient de la DB.
 */

import { Module } from '@nestjs/common';
import { PlatformController } from './controllers/platform.controller';
import { CmsController } from './controllers/cms.controller';
import { PlatformService } from './services/platform.service';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SaisieMasterModule } from '../saisiemaster/saisiemaster.module';

@Module({
  imports: [AuthModule, DatabaseModule, SaisieMasterModule],
  controllers: [PlatformController, CmsController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
