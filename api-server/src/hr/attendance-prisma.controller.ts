/**
 * ============================================================================
 * ATTENDANCE PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service AttendancePrismaService.
 * Les méthodes overtime utilisent `validated` (boolean) au lieu de `status` (string).
 *
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AttendancePrismaService } from './attendance-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { RecordAttendanceDto, RecordOvertimeDto, UpdateAttendanceDto } from './dto/index';

@Controller('hr/attendance')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AttendancePrismaController {
  constructor(private readonly attendanceService: AttendancePrismaService) {}

  // ─── Staff Attendance ────────────────────────────────────────────────────────

  @Post()
  async recordAttendance(@GetTenant() tenant: any, @Body() data: RecordAttendanceDto) {
    return this.attendanceService.recordAttendance({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Put(':id')
  async updateAttendance(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateAttendanceDto) {
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
    @Query('academicYearId') academicYearId?: string,
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

  // ─── Overtime Records ────────────────────────────────────────────────────────

  @Post('overtime')
  async recordOvertime(@GetTenant() tenant: any, @Body() data: RecordOvertimeDto) {
    return this.attendanceService.recordOvertime({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Put('overtime/:id/process')
  async processOvertime(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { action: 'VALIDATE' | 'REJECT', validatedBy?: string },
  ) {
    return this.attendanceService.processOvertime(
      id, tenant.id, body.action, body.validatedBy,
    );
  }

  @Delete(':id')
  async deleteAttendance(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.attendanceService.deleteAttendance(id, tenant.id);
  }

  @Delete('overtime/:id')
  async deleteOvertime(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.attendanceService.deleteOvertime(id, tenant.id);
  }

  @Get('overtime/staff/:staffId')
  async findStaffOvertime(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('validated') validated?: string,
  ) {
    return this.attendanceService.findStaffOvertime(staffId, tenant.id, {
      academicYearId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      validated: validated !== undefined ? validated === 'true' : undefined,
    });
  }
}
