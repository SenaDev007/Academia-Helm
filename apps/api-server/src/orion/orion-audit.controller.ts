/**
 * ============================================================================
 * ORION AUDIT CONTROLLER - MODULE 8
 * ============================================================================
 */

import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { OrionAuditService } from './services/orion-audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('orion/audit')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrionAuditController {
  constructor(private readonly auditService: OrionAuditService) {}

  @Post('log')
  async logAccess(
    @GetTenant() tenant: any,
    @Body() data: { action: string; resourceType?: string; resourceId?: string },
    @Req() req: any,
  ) {
    return this.auditService.logAccess(tenant.id, {
      ...data,
      userId: req.user?.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('logs')
  async findAuditLogs(
    @GetTenant() tenant: any,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.auditService.findAuditLogs(tenant.id, {
      userId,
      action,
      resourceType,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('stats')
  async getAccessStats(
    @GetTenant() tenant: any,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.auditService.getAccessStats(
      tenant.id,
      fromDate ? new Date(fromDate) : undefined,
      toDate ? new Date(toDate) : undefined,
    );
  }
}

