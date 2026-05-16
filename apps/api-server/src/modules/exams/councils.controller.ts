import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query } from '@nestjs/common';
import { CouncilsService } from './services/councils.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { AcademicYearId } from '../../common/decorators/academic-year-id.decorator';
import { UserId } from '../../auth/decorators/user-id.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';

import { PermissionsGuard } from '../../auth/guards/permissions.guard';

@Controller('api/institutional-exams/councils')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CouncilsController {
  constructor(private readonly councilsService: CouncilsService) {}

  @Get()
  @Permissions('exams.read')
  async getCouncils(
    @TenantId() tenantId: string,
    @AcademicYearId() academicYearId: string,
    @Query('periodId') periodId: string,
  ) {
    return this.councilsService.getCouncils(tenantId, academicYearId, periodId);
  }

  @Post()
  @Permissions('exams.manage')
  async create(@TenantId() tenantId: string, @Body() data: any) {
    return this.councilsService.createCouncil(tenantId, data);
  }

  @Get(':id')
  @Permissions('exams.read')
  async getOne(@Param('id') id: string) {
    return this.councilsService.getCouncilDetails(id);
  }

  @Post(':id/decisions/:studentId')
  @Permissions('exams.manage')
  async saveDecision(
    @Param('id') councilId: string,
    @Param('studentId') studentId: string,
    @TenantId() tenantId: string,
    @UserId() userId: string,
    @Body() data: any,
  ) {
    return this.councilsService.saveDecision(tenantId, councilId, studentId, { ...data, userId });
  }

  @Patch(':id/complete')
  @Permissions('exams.manage')
  async complete(@Param('id') id: string) {
    return this.councilsService.closeCouncil(id);
  }
}
