import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GradesService } from './services/grades.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('institutional-exams/grades')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get('evaluation/:id')
  @Permissions('exams.read')
  async getByEvaluation(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.gradesService.getGradingSheet(id, tenantId);
  }

  @Post('evaluation/:id/bulk')
  @Permissions('exams.manage')
  async bulkSave(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Body() grades: any[],
  ) {
    return this.gradesService.bulkSave(tenantId, academicYearId, id, grades);
  }
}
