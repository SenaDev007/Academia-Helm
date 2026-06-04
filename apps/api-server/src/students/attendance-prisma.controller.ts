/**
 * ============================================================================
 * ATTENDANCE PRISMA CONTROLLER
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendancePrismaService } from './attendance-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { RecordAttendanceDto, RecordClassAttendanceDto } from './dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendancePrismaController {
  constructor(private readonly attendanceService: AttendancePrismaService) {}

  @Post()
  async record(
    @TenantId() tenantId: string,
    @Body() recordDto: RecordAttendanceDto,
  ) {
    return this.attendanceService.recordAttendance({
      ...recordDto,
      tenantId,
    });
  }

  @Post('class')
  async recordClass(
    @TenantId() tenantId: string,
    @Body() recordDto: RecordClassAttendanceDto,
  ) {
    return this.attendanceService.recordClassAttendance({
      ...recordDto,
      tenantId,
    });
  }

  @Get('student/:studentId')
  async getStudentAttendance(
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getStudentAttendance(studentId, tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status,
    });
  }

  @Get('class/:classId')
  async getClassAttendance(
    @Param('classId') classId: string,
    @TenantId() tenantId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getClassAttendance(
      classId,
      tenantId,
      new Date(date),
    );
  }

  @Get('statistics')
  async getStatistics(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('classId') classId?: string,
  ) {
    return this.attendanceService.getAttendanceStatistics(
      tenantId,
      academicYearId,
      schoolLevelId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        classId,
      },
    );
  }
}
