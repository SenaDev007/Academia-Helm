import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { SchoolDirectorsService } from './school-directors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('hr/school-directors')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SchoolDirectorsController {
  constructor(private readonly directorsService: SchoolDirectorsService) {}

  @Get()
  @Permissions('hr.read')
  async getDirectors(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.getDirectors(resolvedTenantId);
  }

  @Post()
  @Permissions('hr.manage')
  async upsertDirector(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Body() data: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.upsertDirector(resolvedTenantId, {
      ...data,
      createdById: user?.id,
    });
  }

  @Delete(':id')
  @Permissions('hr.manage')
  async deleteDirector(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.deleteDirector(resolvedTenantId, id);
  }

  @Get('by-level')
  @Permissions('hr.read')
  async getDirectorByLevel(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Headers() headers: any,
    @Query('schoolLevelId') schoolLevelId: string,
    @Query('language') language?: string,
  ) {
    const resolvedTenantId = tenantId || user?.tenantId || headers?.['x-tenant-id'];
    return this.directorsService.getDirectorByLevel(resolvedTenantId, schoolLevelId, language);
  }
}
