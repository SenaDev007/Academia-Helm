/**
 * TEACHER ACADEMIC PROFILE PRISMA CONTROLLER - SM3
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TeacherAcademicProfilePrismaService } from './teacher-academic-profile-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('api/pedagogy/teacher-profiles')
@UseGuards(JwtAuthGuard)
export class TeacherAcademicProfilePrismaController {
  constructor(private readonly service: TeacherAcademicProfilePrismaService) {}

  @Get()
  async findAllProfiles(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.findAllProfiles(tenantId, academicYearId);
  }

  @Get('by-teacher/:teacherId')
  async findProfileByTeacher(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Param('teacherId') teacherId: string,
  ) {
    return this.service.findProfileByTeacher(tenantId, academicYearId, teacherId);
  }

  @Get(':id')
  async getProfile(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.service.getProfileOrThrow(id, tenantId);
  }

  @Post()
  async createProfile(
    @TenantId() tenantId: string,
    @Body()
    body: {
      academicYearId: string;
      teacherId: string;
      maxWeeklyHours: number;
      isSemainier?: boolean;
    },
  ) {
    return this.service.createProfile({ ...body, tenantId });
  }

  @Put(':id')
  async updateProfile(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() body: { maxWeeklyHours?: number; isSemainier?: boolean; isActive?: boolean },
  ) {
    return this.service.updateProfile(id, tenantId, body);
  }

  // ---------- Qualifications ----------
  @Post(':profileId/qualifications')
  async addSubjectQualification(
    @Param('profileId') profileId: string,
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; subjectId: string; certified?: boolean },
  ) {
    return this.service.addSubjectQualification({ ...body, profileId, tenantId });
  }

  @Delete(':profileId/qualifications/:subjectId')
  async removeSubjectQualification(
    @Param('profileId') profileId: string,
    @Param('subjectId') subjectId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.removeSubjectQualification(profileId, subjectId, tenantId);
  }

  // ---------- Niveaux ----------
  @Post(':profileId/level-authorizations')
  async addLevelAuthorization(
    @Param('profileId') profileId: string,
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; levelId: string },
  ) {
    return this.service.addLevelAuthorization({ ...body, profileId, tenantId });
  }

  @Delete(':profileId/level-authorizations/:levelId')
  async removeLevelAuthorization(
    @Param('profileId') profileId: string,
    @Param('levelId') levelId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.removeLevelAuthorization(profileId, levelId, tenantId);
  }

  // ---------- Disponibilités ----------
  @Get(':profileId/availabilities')
  async listAvailabilities(
    @Param('profileId') profileId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.listAvailabilities(profileId, tenantId);
  }

  @Post(':profileId/availabilities')
  async createAvailability(
    @Param('profileId') profileId: string,
    @TenantId() tenantId: string,
    @Body()
    body: { academicYearId: string; dayOfWeek: number; startTime: string; endTime: string },
  ) {
    return this.service.createAvailability({ ...body, profileId, tenantId });
  }

  @Put('availabilities/:availabilityId')
  async updateAvailability(
    @Param('availabilityId') availabilityId: string,
    @TenantId() tenantId: string,
    @Body() body: { dayOfWeek?: number; startTime?: string; endTime?: string },
  ) {
    return this.service.updateAvailability(availabilityId, tenantId, body);
  }

  @Delete('availabilities/:availabilityId')
  async deleteAvailability(
    @Param('availabilityId') availabilityId: string,
    @TenantId() tenantId: string,
  ) {
    return this.service.deleteAvailability(availabilityId, tenantId);
  }
}
