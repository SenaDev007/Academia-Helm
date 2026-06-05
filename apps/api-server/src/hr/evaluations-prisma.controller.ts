/**
 * ============================================================================
 * EVALUATIONS PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 *
 * IMPORTANT: Route order matters! Specific routes (like 'trainings') must be
 * declared BEFORE parameterized routes (like ':id') to avoid shadowing.
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { EvaluationsPrismaService } from './evaluations-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateEvaluationDto, UpdateEvaluationDto, CreateTrainingDto, UpdateTrainingDto } from './dto/index';

@Controller('hr/evaluations')
@UseGuards(JwtAuthGuard, TenantGuard)
export class EvaluationsPrismaController {
  constructor(private readonly evaluationsService: EvaluationsPrismaService) {}

  @Post()
  async createEvaluation(@GetTenant() tenant: any, @Body() data: CreateEvaluationDto) {
    return this.evaluationsService.createEvaluation({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get()
  async findAllEvaluations(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('staffId') staffId?: string,
    @Query('evaluatorId') evaluatorId?: string,
  ) {
    return this.evaluationsService.findAllEvaluations(tenant.id, {
      academicYearId,
      staffId,
      evaluatorId,
    });
  }

  @Get('statistics')
  async getEvaluationStatistics(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.evaluationsService.getEvaluationStatistics(tenant.id, academicYearId);
  }

  // ─── Trainings (MUST be before @Get(':id') to avoid route shadowing) ────────

  @Post('trainings')
  async createTraining(@GetTenant() tenant: any, @Body() data: CreateTrainingDto) {
    return this.evaluationsService.createTraining({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get('trainings')
  async findAllTrainings(@GetTenant() tenant: any) {
    return this.evaluationsService.findAllTrainings(tenant.id);
  }

  @Get('trainings/staff/:staffId')
  async findStaffTrainings(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.evaluationsService.findStaffTrainings(staffId, tenant.id);
  }

  @Get('trainings/:id')
  async findTrainingById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.evaluationsService.findTrainingById(id, tenant.id);
  }

  @Put('trainings/:id')
  async updateTraining(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateTrainingDto) {
    return this.evaluationsService.updateTraining(id, tenant.id, data);
  }

  @Delete('trainings/:id')
  async deleteTraining(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.evaluationsService.deleteTraining(id, tenant.id);
  }

  // ─── Evaluations (parameterized routes AFTER specific routes) ───────────────

  @Get(':id')
  async findEvaluationById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.evaluationsService.findEvaluationById(id, tenant.id);
  }

  @Put(':id')
  async updateEvaluation(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateEvaluationDto) {
    return this.evaluationsService.updateEvaluation(id, tenant.id, data);
  }

  @Delete(':id')
  async deleteEvaluation(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.evaluationsService.deleteEvaluation(id, tenant.id);
  }
}
