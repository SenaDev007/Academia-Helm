import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch } from '@nestjs/common';
import { EvaluationsService } from './services/evaluations.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('institutional-exams/evaluations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get()
  @Permissions('exams.read')
  async findAll(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query() filters: any,
  ) {
    return this.evaluationsService.findAll(tenantId, academicYearId, filters);
  }

  @Post()
  @Permissions('exams.manage')
  async create(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Body() data: any,
  ) {
    return this.evaluationsService.create(tenantId, academicYearId, data);
  }

  @Patch(':id/submit')
  @Permissions('exams.manage')
  async submit(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.evaluationsService.submitForValidation(id, tenantId);
  }

  @Patch(':id/validate')
  @Permissions('exams.validate')
  async validate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
  ) {
    return this.evaluationsService.validate(id, tenantId, userId);
  }
}
