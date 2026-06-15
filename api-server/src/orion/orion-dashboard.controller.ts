/**
 * ============================================================================
 * ORION DASHBOARD CONTROLLER - MODULE 8
 * ============================================================================
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrionDashboardService } from './services/orion-dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('orion/dashboard')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrionDashboardController {
  constructor(private readonly dashboardService: OrionDashboardService) {}

  @Get()
  async getDashboard(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
  ) {
    return this.dashboardService.getDashboardData(
      tenant.id,
      academicYearId,
      schoolLevelId,
    );
  }

  @Get('summary')
  async getExecutiveSummary(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.dashboardService.getExecutiveSummary(tenant.id, academicYearId);
  }
}

