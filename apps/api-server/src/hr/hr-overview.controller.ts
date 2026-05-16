/**
 * ============================================================================
 * HR OVERVIEW CONTROLLER - MODULE 5
 * ============================================================================
 * 
 * Controller pour le cockpit RH (Onglet 1)
 * 
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { HrKpiService } from './hr-kpi.service';
import { HROrionService } from './services/hr-orion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';

@Controller('hr/overview')
@UseGuards(JwtAuthGuard, TenantGuard)
export class HrOverviewController {
  constructor(
    private readonly hrKpiService: HrKpiService,
    private readonly hrOrionService: HROrionService,
  ) {}

  /**
   * Récupère les données consolidées pour le dashboard RH
   */
  @Get('dashboard')
  async getDashboardData(
    @Query('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const snapshot = await this.hrKpiService.generateSnapshot(tenantId, academicYearId);
    const evolution = await this.hrKpiService.getPayrollEvolution(tenantId, academicYearId);
    const orionData = await this.hrOrionService.getPayrollAndTaxKPIs(tenantId, academicYearId);

    return {
      snapshot,
      evolution,
      orionAlerts: orionData.alerts,
    };
  }

  /**
   * Données détaillées pour l'onglet Rapports
   */
  @Get('analytics')
  async getAnalytics(
    @Query('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    const [evolution, distribution, snapshot] = await Promise.all([
      this.hrKpiService.getPayrollEvolution(tenantId, academicYearId),
      this.hrKpiService.getStaffDistribution(tenantId),
      this.hrKpiService.generateSnapshot(tenantId, academicYearId),
    ]);

    return {
      evolution,
      distribution,
      snapshot,
    };
  }

  /**
   * Force le recalcul du snapshot
   */
  @Get('refresh-snapshot')
  async refreshSnapshot(
    @Query('tenantId') tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.hrKpiService.generateSnapshot(tenantId, academicYearId);
  }
}
