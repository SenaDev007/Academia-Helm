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
    
    // Resolve using the same logic as @GetTenant
    const { resolveRequestTenantId } = require('../common/utils/resolve-request-tenant-id');
    const tenantFromResolver = resolveRequestTenantId(req);
    
    // Direct Prisma queries
    const allStaff = await this.prisma.staff.findMany({ take: 3 });
    
    // Test with resolved tenant
    const filteredByResolver = tenantFromResolver 
      ? await this.prisma.staff.findMany({ where: { tenantId: tenantFromResolver } })
      : 'NO_TENANT_RESOLVED';
    
    // Test StaffPrismaService.findAllStaff (same method used by the authenticated endpoint)
    let serviceResult: any = null;
    let serviceError: any = null;
    try {
      serviceResult = await this.staffService.findAllStaff(tenantFromResolver || '59b8c348-ae5f-4d67-8fbd-af6aefa1f394');
    } catch (e: any) {
      serviceError = { message: e.message, code: e.code, meta: e.meta, stack: e.stack?.substring(0, 500) };
    }
    
    // Test StaffPrismaService.createStaff (same method used by the authenticated endpoint)
    let serviceCreateResult: any = null;
    let serviceCreateError: any = null;
    try {
      serviceCreateResult = await this.staffService.createStaff({
        tenantId: tenantFromResolver || '59b8c348-ae5f-4d67-8fbd-af6aefa1f394',
        firstName: 'ServiceTest',
        lastName: 'Debug',
      });
    } catch (e: any) {
      serviceCreateError = { message: e.message, code: e.code, meta: e.meta, stack: e.stack?.substring(0, 500) };
    }
    
    return {
      tenantIdFromHeader,
      tenantIdFromJwt,
      resolvedTenant,
      tenantFromResolver,
      tenantFromResolverType: typeof tenantFromResolver,
      allStaffCount: allStaff.length,
      filteredByResolverCount: typeof filteredByResolver === 'string' ? filteredByResolver : filteredByResolver.length,
      serviceFindAllResult: serviceResult?.length ?? null,
      serviceFindAllError: serviceError,
      serviceCreateResult: serviceCreateResult ? { id: serviceCreateResult.id, employeeNumber: serviceCreateResult.employeeNumber } : null,
      serviceCreateError,
    };
  }
  
  /**
   * DEBUG V2 — Test with auth guards to see what @GetTenant resolves
   */
  @Get('debug/test-auth')
  async debugTestAuth(@GetTenant() tenant: any, @Req() req: any) {
    return {
      tenantFromDecorator: tenant,
      tenantFromDecoratorType: typeof tenant,
      tenantIdFromDecorator: tenant?.id,
      tenantIdFromDecoratorType: typeof tenant?.id,
      reqTenantId: req.tenantId,
      reqTenant: req.tenant,
      reqUserTenantId: req.user?.tenantId,
    };
  }
}

