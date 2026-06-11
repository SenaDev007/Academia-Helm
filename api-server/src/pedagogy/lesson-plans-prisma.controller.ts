/**
 * ============================================================================
 * LESSON PLANS PRISMA CONTROLLER
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
import { LessonPlansPrismaService } from './lesson-plans-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CreateLessonPlanDto } from './dto/create-lesson-plan.dto';
import { UpdateLessonPlanDto } from './dto/update-lesson-plan.dto';

@Controller('lesson-plans')
@UseGuards(JwtAuthGuard)
export class LessonPlansPrismaController {
  constructor(private readonly lessonPlansService: LessonPlansPrismaService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() createDto: CreateLessonPlanDto,
  ) {
    return this.lessonPlansService.createLessonPlan(tenantId, createDto as any);
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('classId') classId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.lessonPlansService.findAllLessonPlans(tenantId, academicYearId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.lessonPlansService.findLessonPlanById(id, tenantId);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: UpdateLessonPlanDto,
  ) {
    return this.lessonPlansService.updateLessonPlan(id, tenantId, updateDto as any);
  }

  @Post(':id/publish')
  async publish(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.lessonPlansService.publishLessonPlan(id, tenantId);
  }

  @Delete(':id')
  async delete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.lessonPlansService.deleteLessonPlan(id, tenantId);
  }
}
