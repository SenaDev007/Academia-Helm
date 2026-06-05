import { Module } from '@nestjs/common';
import { BilingualAnalysisService } from './services/bilingual-analysis.service';
import { OrionBilingualController } from './orion-bilingual.controller';
import { OrionAlertsController } from './orion-alerts.controller';
import { OrionAlertsService } from './services/orion-alerts.service';
import { TenantFeaturesModule } from '../tenant-features/tenant-features.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    TenantFeaturesModule,
    DatabaseModule, // Pour Prisma (ORION Alerts utilise Prisma)
  ],
  controllers: [OrionBilingualController, OrionAlertsController],
  providers: [BilingualAnalysisService, OrionAlertsService],
  exports: [BilingualAnalysisService, OrionAlertsService],
})
export class OrionBilingualModule {}

