/**
 * ============================================================================
 * ATTENDANCE PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 */

import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendancePrismaService } from './attendance-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('api/hr/attendance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AttendancePrismaController {
  constructor(private readonly attendanceService: AttendancePrismaService) {}

  @Post()
  async recordAttendance(@GetTenant() tenant: any, @Body() data: any) {
    return this.attendanceService.recordAttendance({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Put(':id')
  async updateAttendance(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: any) {
    return this.attendanceService.updateAttendance(id, tenant.id, data);
  }

  @Get('staff/:staffId')
  async findStaffAttendances(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.findStaffAttendances(staffId, tenant.id, {
      academicYearId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });
  }

  @Get('statistics')
  async getAttendanceStatistics(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getAttendanceStatistics(tenant.id, academicYearId, {
      staffId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // Overtime
  @Post('overtime')
  async recordOvertime(@GetTenant() tenant: any, @Body() data: any) {
    return this.attendanceService.recordOvertime({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Put('overtime/:id/process')
  async processOvertime(
    @GetTenant() tenant: any, 
    @Param('id') id: string, 
    @Body() body: { status: 'APPROVED' | 'REJECTED', approvedBy?: string }
  ) {
    return this.attendanceService.processOvertime(id, tenant.id, body.status, body.approvedBy);
  }

  @Get('overtime/staff/:staffId')
  async findStaffOvertime(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.findStaffOvertime(staffId, tenant.id, {
      academicYearId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });
  }
}

