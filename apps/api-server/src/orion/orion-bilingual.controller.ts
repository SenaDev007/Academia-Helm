import { Controller, Get, UseGuards } from '@nestjs/common';
import { BilingualAnalysisService } from './services/bilingual-analysis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
// UserRole n'existe plus, utiliser le type string directement
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('orion/bilingual')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrionBilingualController {
  constructor(private readonly bilingualAnalysisService: BilingualAnalysisService) {}

  @Get('comparison')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  async getComparison(@TenantId() tenantId: string) {
    return this.bilingualAnalysisService.compareAverageScores(tenantId);
  }

  @Get('statistics')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  async getStatistics(@TenantId() tenantId: string) {
    const frStats = await this.bilingualAnalysisService.getTrackStatistics(tenantId, 'FR' as any);
    const enStats = await this.bilingualAnalysisService.getTrackStatistics(tenantId, 'EN' as any);
    return { fr: frStats, en: enStats };
  }

  @Get('class-gaps')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  async getClassGaps(@TenantId() tenantId: string) {
    return this.bilingualAnalysisService.analyzePerformanceGapByClass(tenantId);
  }

  @Get('alerts')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  async getAlerts(@TenantId() tenantId: string) {
    return this.bilingualAnalysisService.generateBilingualAlerts(tenantId);
  }

  @Get('report')
  @Roles('SUPER_ADMIN', 'DIRECTEUR', 'PROMOTEUR')
  async getReport(@TenantId() tenantId: string) {
    return this.bilingualAnalysisService.generateComparativeReport(tenantId);
  }
}

