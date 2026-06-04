/**
 * ============================================================================
 * STAFF PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { StaffPrismaService } from './staff-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CreateStaffDto, UpdateStaffDto, AddStaffDocumentDto } from './dto/index';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StaffPrismaController {
  private readonly logger = new (require('@nestjs/common').Logger)('StaffController');

  constructor(private readonly staffService: StaffPrismaService, private readonly prisma: PrismaService) {}

  @Post()
  async createStaff(@GetTenant() tenant: any, @Body() data: CreateStaffDto) {
    this.logger.warn(`[DEBUG] createStaff tenant=${JSON.stringify(tenant)} dataKeys=${Object.keys(data).join(',')}`);
    return this.staffService.createStaff({
      ...data,
      tenantId: tenant?.id,
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
    this.logger.warn(`[DEBUG] findAllStaff tenant=${JSON.stringify(tenant)}`);
    return this.staffService.findAllStaff(tenant?.id, {
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

  /**
   * DEBUG — Diagnostic temporaire (à retirer après débogage)
   */
  @Public()
  @Get('debug/test-db')
  async debugTestDb(@Req() req: any) {
    const tenantIdFromHeader = req.headers['x-tenant-id'];
    const tenantIdFromJwt = req.user?.tenantId;
    const resolvedTenant = req.tenantId;
    
    // Direct Prisma queries
    const allStaff = await this.prisma.staff.findMany({ take: 3 });
    const filteredStaff = await this.prisma.staff.findMany({ where: { tenantId: tenantIdFromHeader } });
    
    // Test StaffPrismaService.findAllStaff (same method used by the authenticated endpoint)
    let serviceResult: any = null;
    let serviceError: any = null;
    try {
      serviceResult = await this.staffService.findAllStaff(tenantIdFromHeader || '59b8c348-ae5f-4d67-8fbd-af6aefa1f394');
    } catch (e: any) {
      serviceError = { message: e.message, code: e.code, meta: e.meta, stack: e.stack?.substring(0, 500) };
    }
    
    // Test StaffPrismaService.createStaff (same method used by the authenticated endpoint)
    let serviceCreateResult: any = null;
    let serviceCreateError: any = null;
    try {
      serviceCreateResult = await this.staffService.createStaff({
        tenantId: tenantIdFromHeader || '59b8c348-ae5f-4d67-8fbd-af6aefa1f394',
        firstName: 'ServiceTest',
        lastName: 'Debug',
      });
    } catch (e: any) {
      serviceCreateError = { message: e.message, code: e.code, meta: e.meta, stack: e.stack?.substring(0, 500) };
    }
    
    // Try create with raw Prisma
    let createResult: any = null;
    let createError: any = null;
    try {
      const { randomUUID } = require('crypto');
      createResult = await this.prisma.staff.create({
        data: {
          id: randomUUID(),
          tenantId: tenantIdFromHeader || '59b8c348-ae5f-4d67-8fbd-af6aefa1f394',
          employeeNumber: 'DEBUG-' + Date.now(),
          firstName: 'DebugTest',
          lastName: 'User',
          roleType: 'TEACHER',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
    } catch (e: any) {
      createError = { message: e.message, code: e.code, meta: e.meta };
    }
    
    return {
      tenantIdFromHeader,
      tenantIdFromJwt,
      resolvedTenant,
      allStaffCount: allStaff.length,
      filteredStaffCount: filteredStaff.length,
      serviceFindAllResult: serviceResult?.length ?? null,
      serviceFindAllError: serviceError,
      serviceCreateResult: serviceCreateResult ? { id: serviceCreateResult.id, employeeNumber: serviceCreateResult.employeeNumber } : null,
      serviceCreateError,
      createResult: createResult ? { id: createResult.id, employeeNumber: createResult.employeeNumber } : null,
      createError,
    };
  }
}

