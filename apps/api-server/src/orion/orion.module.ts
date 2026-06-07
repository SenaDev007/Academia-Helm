/**
 * ============================================================================
 * ORION MODULE - MODULE 8
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantFeaturesModule } from '../tenant-features/tenant-features.module';
import { OrionAlertsService } from './services/orion-alerts.service';
import { KPICalculationService } from './services/kpi-calculation.service';
import { OrionInsightsService } from './services/orion-insights.service';
import { OrionDashboardService } from './services/orion-dashboard.service';
import { OrionAuditService } from './services/orion-audit.service';
import { BilingualAnalysisService } from './services/bilingual-analysis.service';
import { OrionAlertsController } from './orion-alerts.controller';
import { OrionKPIController } from './orion-kpi.controller';
import { OrionInsightsController } from './orion-insights.controller';
import { OrionDashboardController } from './orion-dashboard.controller';
import { OrionAuditController } from './orion-audit.controller';
import { OrionBilingualController } from './orion-bilingual.controller';

@Module({
  imports: [
    DatabaseModule,
    TenantFeaturesModule, // ✅ Pour TenantFeaturesService
  ],
  controllers: [
    OrionAlertsController,
    OrionKPIController,
    OrionInsightsController,
    OrionDashboardController,
    OrionAuditController,
    OrionBilingualController,
  ],
  providers: [
    OrionAlertsService,
    KPICalculationService,
    OrionInsightsService,
    OrionDashboardService,
    OrionAuditService,
    BilingualAnalysisService,
  ],
  exports: [
    OrionAlertsService,
    KPICalculationService,
    OrionInsightsService,
    OrionDashboardService,
    OrionAuditService,
    BilingualAnalysisService,
  ],
})
export class OrionModule {}

