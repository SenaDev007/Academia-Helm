/**
 * ORION PEDAGOGY ADVANCED CONTROLLER - SM8
 * Insights, risk flags, forecasts (lecture seule).
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { OrionPedagogyAdvancedService } from './orion-pedagogy-advanced.service';

@Controller('api/pedagogy/orion-advanced')
@UseGuards(JwtAuthGuard)
export class OrionPedagogyAdvancedController {
  constructor(private readonly service: OrionPedagogyAdvancedService) {}

  @Get('dashboard')
  async getDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string
  ) {
    return this.service.getOrionDashboard(tenantId, academicYearId);
  }

  @Get('insights')
  async getInsights(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('scopeType') scopeType?: string,
    @Query('severity') severity?: string
  ) {
    if (!academicYearId) return [];
    return this.service.findInsights(tenantId, academicYearId, {
      scopeType,
      severity,
    });
  }

  @Get('risk-flags')
  async getRiskFlags(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('entityType') entityType?: string,
    @Query('level') level?: string
  ) {
    if (!academicYearId) return [];
    return this.service.findRiskFlags(tenantId, academicYearId, {
      entityType,
      level,
    });
  }

  @Get('forecasts')
  async getForecasts(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('entityType') entityType?: string
  ) {
    if (!academicYearId) return [];
    return this.service.findForecasts(tenantId, academicYearId, {
      entityType,
    });
  }
}
