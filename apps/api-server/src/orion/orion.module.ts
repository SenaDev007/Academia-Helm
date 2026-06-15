/**
 * ============================================================================
 * ORION MODULE - MODULE 8
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { TenantFeaturesModule } from '../tenant-features/tenant-features.module';
import { AIModule } from '../ai/ai.module';
import { OrionAlertsService } from './services/orion-alerts.service';
import { KPICalculationService } from './services/kpi-calculation.service';
import { OrionInsightsService } from './services/orion-insights.service';
import { OrionDashboardService } from './services/orion-dashboard.service';
import { OrionAuditService } from './services/orion-audit.service';
import { BilingualAnalysisService } from './services/bilingual-analysis.service';
import { OrionIntelligenceService } from './services/orion-intelligence.service';
import { OrionAlertsController } from './orion-alerts.controller';
import { OrionKPIController } from './orion-kpi.controller';
import { OrionInsightsController } from './orion-insights.controller';
import { OrionDashboardController } from './orion-dashboard.controller';
import { OrionAuditController } from './orion-audit.controller';
import { OrionBilingualController } from './orion-bilingual.controller';
import { OrionIntelligenceController } from './orion-intelligence.controller';

@Module({
  imports: [
    DatabaseModule,
    TenantFeaturesModule, // Pour TenantFeaturesService
    AIModule, // AI Gateway + MCP + Tool Calling
  ],
  controllers: [
    OrionAlertsController,
    OrionKPIController,
    OrionInsightsController,
    OrionDashboardController,
    OrionAuditController,
    OrionBilingualController,
    OrionIntelligenceController,
  ],
  providers: [
    OrionAlertsService,
    KPICalculationService,
    OrionInsightsService,
    OrionDashboardService,
    OrionAuditService,
    BilingualAnalysisService,
    OrionIntelligenceService,
  ],
  exports: [
    OrionAlertsService,
    KPICalculationService,
    OrionInsightsService,
    OrionDashboardService,
    OrionAuditService,
    BilingualAnalysisService,
    OrionIntelligenceService,
  ],
})
export class OrionModule {}

