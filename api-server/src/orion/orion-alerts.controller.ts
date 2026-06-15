/**
 * ============================================================================
 * ORION ALERTS CONTROLLER - MODULE 8
 * ============================================================================
 */

import { Controller, Get, Post, Put, Param, Query, Body, UseGuards } from '@nestjs/common';
import { OrionAlertsService } from './services/orion-alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('orion/alerts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrionAlertsController {
  constructor(private readonly orionAlertsService: OrionAlertsService) {}

  @Get()
  async getActiveAlerts(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('alertType') alertType?: string,
    @Query('severity') severity?: string,
    @Query('acknowledged') acknowledged?: string,
  ) {
    return this.orionAlertsService.getActiveAlerts(tenant.id, {
      academicYearId,
      schoolLevelId,
      alertType,
      severity,
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    });
  }

  @Post('generate')
  async generateAlerts(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.orionAlertsService.generateAllAlerts(tenant.id, academicYearId);
  }

  @Put(':id/acknowledge')
  async acknowledgeAlert(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { userId?: string },
  ) {
    await this.orionAlertsService.acknowledgeAlert(id, tenant.id, body.userId);
    return { success: true };
  }
}

