/**
 * ============================================================================
 * SYNTHESIS CONTROLLER - ENDPOINTS DE SYNTHÈSE (LECTURE SEULE)
 * ============================================================================
 * 
 * Controller qui expose les vues d'agrégation en lecture seule.
 * Aucune modification des données n'est possible via ces endpoints.
 * 
 * ============================================================================
 */

import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SynthesisService } from './synthesis.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ContextValidationGuard } from '../../common/guards/context-validation.guard';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../../common/decorators/school-level-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

@Controller('synthesis')
@UseGuards(
  JwtAuthGuard,
  ContextValidationGuard,
  RolesGuard,
  PermissionsGuard,
)
@UseInterceptors(AuditLogInterceptor)
export class SynthesisController {
  constructor(private readonly synthesisService: SynthesisService) {}

  /**
   * GET /api/synthesis/finances-by-module
   * Finances par module et par niveau
   */
  @Get('finances-by-module')
  @Permissions('synthesis.read', 'finance.read')
  async getFinancesByModule(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.synthesisService.getFinancesByModuleAndLevel(tenantId, schoolLevelId);
  }

  /**
   * GET /api/synthesis/finances-by-level
   * Finances par niveau (tous modules confondus)
   */
  @Get('finances-by-level')
  @Permissions('synthesis.read', 'finance.read')
  async getFinancesByLevel(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.synthesisService.getFinancesByLevel(tenantId, schoolLevelId);
  }

  /**
   * GET /api/synthesis/effectifs-by-level
   * Effectifs par niveau
   */
  @Get('effectifs-by-level')
  @Permissions('synthesis.read', 'students.read')
  async getEffectifsByLevel(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.synthesisService.getEffectifsByLevel(tenantId, schoolLevelId);
  }

  /**
   * GET /api/synthesis/kpi-global
   * KPI globaux par tenant (tous niveaux confondus)
   */
  @Get('kpi-global')
  @Permissions('synthesis.read')
  async getKPIGlobal(@TenantId() tenantId: string) {
    return this.synthesisService.getKPIGlobalByTenant(tenantId);
  }

  /**
   * GET /api/synthesis/dashboard
   * Tableau de bord synthèse par tenant et niveau
   */
  @Get('dashboard')
  @Permissions('synthesis.read')
  async getDashboard(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.synthesisService.getDashboardSynthesis(tenantId, schoolLevelId);
  }

  /**
   * GET /api/synthesis/dashboard-with-kpi
   * Tableau de bord synthèse avec tous les KPI calculés
   */
  @Get('dashboard-with-kpi')
  @Permissions('synthesis.read')
  async getDashboardWithKPI(
    @TenantId() tenantId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.synthesisService.getSynthesisWithKPI(tenantId, schoolLevelId);
  }

  /**
   * GET /api/synthesis/revenue-growth-rate
   * Taux de croissance des revenus entre deux périodes
   */
  @Get('revenue-growth-rate')
  @Permissions('synthesis.read', 'finance.read')
  async getRevenueGrowthRate(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('previousPeriodStart') previousPeriodStart: string,
    @Query('previousPeriodEnd') previousPeriodEnd: string,
  ) {
    return this.synthesisService.calculateRevenueGrowthRate(
      tenantId,
      schoolLevelId,
      new Date(periodStart),
      new Date(periodEnd),
      new Date(previousPeriodStart),
      new Date(previousPeriodEnd),
    );
  }

  /**
   * GET /api/synthesis/class-occupancy-rate
   * Taux de remplissage des classes
   */
  @Get('class-occupancy-rate')
  @Permissions('synthesis.read', 'students.read')
  async getClassOccupancyRate(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.synthesisService.calculateClassOccupancyRate(tenantId, schoolLevelId);
  }
}

