/**
 * ============================================================================
 * DASHBOARD CONTROLLER - ENDPOINTS POUR LES DASHBOARDS
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireTenant } from '../common/decorators/require-tenant.decorator';
import { TenantRequiredGuard } from '../common/guards/tenant-required.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * KPIs pour le dashboard Promoteur
   */
  @RequireTenant()
  @UseGuards(JwtAuthGuard, TenantRequiredGuard)
  @Get('promoter/kpis')
  async getPromoterKpis(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const tenantId = req.user.tenantId || req['tenantId'];
    return this.dashboardService.getPromoterKpis(tenantId, academicYearId);
  }

  /**
   * KPIs pour le dashboard Directeur
   */
  @RequireTenant()
  @UseGuards(JwtAuthGuard, TenantRequiredGuard)
  @Get('director/kpis')
  async getDirectorKpis(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const tenantId = req.user.tenantId || req['tenantId'];
    return this.dashboardService.getDirectorKpis(tenantId, academicYearId);
  }

  /**
   * KPIs pour le dashboard Comptable
   */
  @RequireTenant()
  @UseGuards(JwtAuthGuard, TenantRequiredGuard)
  @Get('accountant/kpis')
  async getAccountantKpis(
    @Req() req: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const tenantId = req.user.tenantId || req['tenantId'];
    return this.dashboardService.getAccountantKpis(tenantId, academicYearId);
  }
}
