/**
 * SOUS-MODULE 7 — Rapports financiers — API
 */
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { FinanceReportsService } from './finance-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/reports')
@UseGuards(JwtAuthGuard)
export class FinanceReportsController {
  constructor(private readonly service: FinanceReportsService) {}

  @Get('kpi')
  async getKpi(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return {};
    return this.service.getKpi(tenantId, academicYearId);
  }

  @Post('export-log')
  async logExport(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; reportType: string },
  ) {
    return this.service.logExport(tenantId, body.academicYearId, body.reportType, user?.id);
  }
}
