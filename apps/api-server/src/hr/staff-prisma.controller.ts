/**
 * ============================================================================
 * STAFF PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StaffPrismaService } from './staff-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';

@Controller('api/hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffPrismaController {
  constructor(private readonly staffService: StaffPrismaService) {}

  @Post()
  async createStaff(@GetTenant() tenant: any, @Body() data: any) {
    return this.staffService.createStaff({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get()
  async findAllStaff(
    @GetTenant() tenant: any,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('roleType') roleType?: string,
    @Query('status') status?: string,
  ) {
    return this.staffService.findAllStaff(tenant.id, {
      academicYearId,
      schoolLevelId,
      roleType,
      status,
    });
  }

  @Get(':id')
  async findStaffById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.staffService.findStaffById(id, tenant.id);
  }

  @Put(':id')
  async updateStaff(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: any) {
    return this.staffService.updateStaff(id, tenant.id, data);
  }

  @Delete(':id')
  async archiveStaff(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.staffService.archiveStaff(id, tenant.id);
  }

  // Documents
  @Post(':id/documents')
  async addStaffDocument(@GetTenant() tenant: any, @Param('id') staffId: string, @Body() data: any) {
    return this.staffService.addStaffDocument({
      ...data,
      tenantId: tenant.id,
      staffId,
    });
  }

  @Get(':id/documents')
  async findStaffDocuments(@GetTenant() tenant: any, @Param('id') staffId: string) {
    return this.staffService.findStaffDocuments(staffId, tenant.id);
  }

  @Put('documents/:id/validate')
  async validateDocument(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.staffService.validateDocument(id, tenant.id);
  }
}

