/**
 * ============================================================================
 * STUDENT ARREAR CONTROLLER
 * ============================================================================
 */

import { Controller, Get, Post, Query, Param, Body, UseGuards } from '@nestjs/common';
import { StudentArrearService } from './student-arrear.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('finance/student-arrears')
@UseGuards(JwtAuthGuard)
export class StudentArrearController {
  constructor(private readonly arrearService: StudentArrearService) {}

  @Post('generate')
  async generateArrears(
    @Body() data: {
      fromAcademicYearId: string;
      toAcademicYearId: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.arrearService.generateArrearsForYear(
      user.tenantId || '',
      data.fromAcademicYearId,
      data.toAcademicYearId,
    );
  }

  @Get('student/:studentId')
  async getStudentArrears(
    @Param('studentId') studentId: string,
    @Query('toAcademicYearId') toAcademicYearId: string,
  ) {
    return this.arrearService.getStudentArrears(studentId, toAcademicYearId);
  }

  @Get()
  async getAllArrears(
    @CurrentUser() user: User,
    @Query('toAcademicYearId') toAcademicYearId: string,
    @Query('status') status?: string,
  ) {
    return this.arrearService.getAllArrears(
      user.tenantId || '',
      toAcademicYearId,
      status,
    );
  }

  @Get('stats')
  async getArrearStats(
    @Query('toAcademicYearId') toAcademicYearId: string,
    @CurrentUser() user: User,
  ) {
    return this.arrearService.getArrearStats(
      user.tenantId || '',
      toAcademicYearId,
    );
  }
}

