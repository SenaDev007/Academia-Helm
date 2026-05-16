/**
 * ============================================================================
 * EXAMS PRISMA CONTROLLER - MODULE 3
 * ============================================================================
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
import { ExamsPrismaService } from './exams-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@Controller('api/exams')
@UseGuards(JwtAuthGuard)
export class ExamsPrismaController {
  constructor(private readonly examsService: ExamsPrismaService) {}

  @Post()
  async create(@TenantId() tenantId: string, @Body() createDto: any) {
    return this.examsService.createExam({
      ...createDto,
      tenantId,
    });
  }

  @Get('dashboard')
  async getDashboard(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) {
      return {
        plannedCount: 0, totalScores: 0, validatedScores: 0,
        missingGrades: 0, globalAverage: 0, successRate: 0,
        generatedBulletins: 0, lockedClasses: 0, orionAlerts: 0,
      };
    }
    return this.examsService.getDashboard(tenantId, academicYearId);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('academicTrackId') academicTrackId?: string,
    @Query('quarterId') quarterId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('examType') examType?: string,
    @Query('search') search?: string,
  ) {
    return this.examsService.findAllExams(tenantId, {
      academicYearId,
      schoolLevelId,
      academicTrackId: academicTrackId || undefined,
      quarterId,
      classId,
      subjectId,
      examType,
      search,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.findExamById(id, tenantId);
  }

  @Get(':id/statistics')
  async getStatistics(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.getExamStatistics(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.examsService.updateExam(id, tenantId, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.examsService.deleteExam(id, tenantId);
  }
}

