import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { ValidationService } from './services/validation.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { SchoolLevelId } from '../../common/decorators/school-level-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('api/institutional-exams/validation')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  @Get('pending')
  @Permissions('exams.validate')
  async getPending(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @SchoolLevelId() schoolLevelId: string,
  ) {
    return this.validationService.getPendingBatches(tenantId, academicYearId, schoolLevelId);
  }

  @Patch('batch/:id/approve')
  @Permissions('exams.validate')
  async approve(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body('comment') comment?: string,
  ) {
    return this.validationService.approveBatch(id, tenantId, userId, comment);
  }

  @Patch('batch/:id/reject')
  @Permissions('exams.validate')
  async reject(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body('comment') comment: string,
  ) {
    return this.validationService.rejectBatch(id, tenantId, userId, comment);
  }
}
