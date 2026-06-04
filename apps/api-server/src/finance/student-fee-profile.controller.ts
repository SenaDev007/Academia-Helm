/**
 * ============================================================================
 * STUDENT FEE PROFILE CONTROLLER
 * ============================================================================
 */

import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentFeeProfileService } from './student-fee-profile.service';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('finance/student-fee-profiles')
@UseGuards(JwtAuthGuard)
export class StudentFeeProfileController {
  constructor(private readonly profileService: StudentFeeProfileService) {}

  @Post()
  async upsertProfile(
    @Body() data: {
      studentId: string;
      academicYearId: string;
      feeRegimeId: string;
      justification?: string;
    },
    @CurrentUser() user: User,
  ) {
    return this.profileService.upsertProfile(
      data.studentId,
      data.academicYearId,
      {
        ...data,
        validatedBy: user.id,
      },
    );
  }

  @Get('student/:studentId')
  async getProfile(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.profileService.getProfile(studentId, academicYearId);
  }

  @Get('student/:studentId/history')
  async getStudentProfiles(@Param('studentId') studentId: string) {
    return this.profileService.getStudentProfiles(studentId);
  }

  @Put('student/:studentId/validate')
  async validateProfile(
    @Param('studentId') studentId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentUser() user: User,
  ) {
    return this.profileService.validateProfile(
      studentId,
      academicYearId,
      user.id,
    );
  }
}

