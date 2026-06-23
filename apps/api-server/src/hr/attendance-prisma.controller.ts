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

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
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
  async recordAttendance(
    @GetTenant() tenant: any,
    @Body() data: RecordAttendanceDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.recordAttendance({
      ...data,
      tenantId: tid,
    });
  }

  @Put(':id')
  async updateAttendance(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateAttendanceDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.updateAttendance(id, tid, data);
  }

  @Get('staff/:staffId')
  async findStaffAttendances(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.attendanceService.findStaffAttendances(staffId, tid, {
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
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.attendanceService.getAttendanceStatistics(tid, academicYearId, {
      staffId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  // ─── Overtime Records ────────────────────────────────────────────────────────

  @Post('overtime')
  async recordOvertime(
    @GetTenant() tenant: any,
    @Body() data: RecordOvertimeDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.recordOvertime({
      ...data,
      tenantId: tid,
    });
  }

  @Put('overtime/:id/process')
  async processOvertime(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { action: 'VALIDATE' | 'REJECT', validatedBy?: string },
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.processOvertime(
      id, tid, body.action, body.validatedBy,
    );
  }

  @Delete(':id')
  async deleteAttendance(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.deleteAttendance(id, tid);
  }

  @Delete('overtime/:id')
  async deleteOvertime(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.attendanceService.deleteOvertime(id, tid);
  }

  @Get('overtime/staff/:staffId')
  async findStaffOvertime(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('validated') validated?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.attendanceService.findStaffOvertime(staffId, tid, {
      academicYearId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      validated: validated !== undefined ? validated === 'true' : undefined,
    });
  }
}
