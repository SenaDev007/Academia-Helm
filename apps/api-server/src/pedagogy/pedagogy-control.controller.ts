/**
 * PEDAGOGY CONTROL CONTROLLER - SM7 - KPI dashboard
 */

import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PedagogyKpiService } from './pedagogy-kpi.service';

@Controller('api/pedagogy/control')
@UseGuards(JwtAuthGuard)
export class PedagogyControlController {
  constructor(private readonly kpiService: PedagogyKpiService) {}

  @Get('dashboard')
  async getDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string
  ) {
    if (!academicYearId) {
      return {
        lessonPlanRate: 0,
        journalRate: 0,
        classLogRate: 0,
        weeklyReportRate: 0,
        overallRate: 0,
        totalActiveAssignments: 0,
        totalActiveProfiles: 0,
        lastCalculatedAt: null,
        snapshotsCount: 0,
      };
    }
    return this.kpiService.getDashboard(tenantId, academicYearId);
  }

  @Get('snapshots')
  async getSnapshots(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
    @Query('classId') classId?: string
  ) {
    if (!academicYearId) return [];
    return this.kpiService.findSnapshots(tenantId, academicYearId, {
      teacherId,
      classId,
    });
  }

  @Post('snapshots')
  async createSnapshot(
    @TenantId() tenantId: string,
    @Body()
    body: {
      academicYearId: string;
      teacherId?: string | null;
      classId?: string | null;
      lessonPlanRate: number;
      journalRate: number;
      classLogRate: number;
      weeklyReportRate: number;
    }
  ) {
    return this.kpiService.createSnapshot(tenantId, body.academicYearId, body);
  }
}
