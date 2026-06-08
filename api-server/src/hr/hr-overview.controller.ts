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
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

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
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    const snapshot = await this.hrKpiService.generateSnapshot(tenant?.id, academicYearId);
    const evolution = await this.hrKpiService.getPayrollEvolution(tenant?.id, academicYearId);
    const orionData = await this.hrOrionService.getPayrollAndTaxKPIs(tenant?.id, academicYearId);

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
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    const [evolution, distribution, snapshot] = await Promise.all([
      this.hrKpiService.getPayrollEvolution(tenant?.id, academicYearId),
      this.hrKpiService.getStaffDistribution(tenant?.id),
      this.hrKpiService.generateSnapshot(tenant?.id, academicYearId),
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
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.hrKpiService.generateSnapshot(tenant?.id, academicYearId);
  }
}
