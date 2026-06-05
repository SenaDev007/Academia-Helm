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
import { CreateStaffDto, UpdateStaffDto, AddStaffDocumentDto } from './dto/index';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffPrismaController {
  constructor(private readonly staffService: StaffPrismaService) {}

  @Post()
  async createStaff(@GetTenant() tenant: any, @Body() data: CreateStaffDto) {
    return this.staffService.createStaff({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get()
  async findAllStaff(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('levelAssigned') levelAssigned?: string,
  ) {
    return this.staffService.findAllStaff(tenant.id, {
      academicYearId,
      category,
      status,
      levelAssigned,
    });
  }

  @Get(':id')
  async findStaffById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.staffService.findStaffById(id, tenant.id);
  }

  @Put(':id')
  async updateStaff(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: UpdateStaffDto) {
    return this.staffService.updateStaff(id, tenant.id, data);
  }

  @Delete(':id')
  async archiveStaff(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.staffService.archiveStaff(id, tenant.id);
  }

  // Documents
  @Post(':id/documents')
  async addStaffDocument(@GetTenant() tenant: any, @Param('id') staffId: string, @Body() data: AddStaffDocumentDto) {
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

  @Delete(':staffId/documents/:docId')
  async deleteStaffDocument(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Param('docId') docId: string,
  ) {
    return this.staffService.deleteStaffDocument(docId, staffId, tenant.id);
  }
}
