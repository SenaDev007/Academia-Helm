/**
 * ============================================================================
 * DASHBOARD CONTROLLER - ENDPOINTS POUR LES DASHBOARDS
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * KPIs pour le dashboard Promoteur
   */
  @Get('promoter/kpis')
  async getPromoterKpis(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.dashboardService.getPromoterKpis(tenant.id, academicYearId);
  }

  /**
   * KPIs pour le dashboard Directeur
   */
  @Get('director/kpis')
  async getDirectorKpis(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.dashboardService.getDirectorKpis(tenant.id, academicYearId);
  }

  /**
   * KPIs pour le dashboard Comptable
   */
  @Get('accountant/kpis')
  async getAccountantKpis(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.dashboardService.getAccountantKpis(tenant.id, academicYearId);
  }
}
