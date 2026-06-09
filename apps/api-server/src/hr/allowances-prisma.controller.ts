/**
 * ============================================================================
 * ALLOWANCES PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service AllowancesPrismaService réécrit.
 * Utilise les modèles AllowanceType et StaffAllowance.
 *
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AllowancesPrismaService } from './allowances-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateAllowanceTypeDto, AssignAllowanceToStaffDto, UpdateAllowanceTypeDto, UpdateStaffAllowanceDto } from './dto';

@Controller('hr/allowances')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AllowancesPrismaController {
  constructor(private readonly allowancesService: AllowancesPrismaService) {}

  // ─── Allowance Types ────────────────────────────────────────────────────────

  @Post('types')
  async createAllowanceType(
    @GetTenant() tenant: any,
    @Body() data: CreateAllowanceTypeDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // Map defaultAmount → amount if amount not provided
    const amount = data.amount ?? data.defaultAmount;
    return this.allowancesService.createAllowanceType({
      tenantId: tid,
      name: data.name,
      code: data.code,
      description: data.description,
      isTaxable: data.isTaxable,
      isCnss: data.isCnss,
      amount: amount ?? undefined,
      isFixed: data.isFixed,
      isActive: data.isActive,
    });
  }

  @Get('types')
  async findAllAllowanceTypes(
    @GetTenant() tenant: any,
    @Query('includeInactive') includeInactive?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.allowancesService.findAllAllowanceTypes(
      tid,
      includeInactive === 'true',
    );
  }

  @Get('types/:id')
  async findAllowanceTypeById(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.allowancesService.findAllowanceTypeById(id, tid);
  }

  @Put('types/:id')
  async updateAllowanceType(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateAllowanceTypeDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.allowancesService.updateAllowanceType(id, tid, data as any);
  }

  @Delete('types/:id')
  async deleteAllowanceType(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.allowancesService.deleteAllowanceType(id, tid);
  }

  // ─── Staff Allowance Assignments ────────────────────────────────────────────

  @Post('assignments')
  async assignAllowanceToStaff(
    @GetTenant() tenant: any,
    @Body() data: AssignAllowanceToStaffDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    // Map startDate → effectiveDate if effectiveDate not provided
    const effectiveDate = data.effectiveDate || data.startDate || new Date().toISOString();
    return this.allowancesService.assignAllowanceToStaff({
      tenantId: tid,
      academicYearId: data.academicYearId,
      schoolLevelId: data.schoolLevelId,
      staffId: data.staffId,
      allowanceTypeId: data.allowanceTypeId,
      amount: data.amount,
      effectiveDate: new Date(effectiveDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      notes: data.notes,
    });
  }

  @Get('assignments')
  async findAllStaffAllowances(
    @GetTenant() tenant: any,
    @Query('staffId') staffId?: string,
    @Query('allowanceTypeId') allowanceTypeId?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.allowancesService.findAllStaffAllowances(tid, {
      staffId,
      allowanceTypeId,
      status,
    });
  }

  @Get('staff/:staffId')
  async findStaffAllowances(
    @GetTenant() tenant: any,
    @Param('staffId') staffId: string,
    @Query('includeInactive') includeInactive?: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    return this.allowancesService.findStaffAllowances(
      staffId, tid, includeInactive === 'true',
    );
  }

  @Put('assignments/:id')
  async updateStaffAllowance(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() data: UpdateStaffAllowanceDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.allowancesService.updateStaffAllowance(id, tid, data as any);
  }

  @Delete('assignments/:id')
  async removeStaffAllowance(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.allowancesService.removeStaffAllowance(id, tid);
  }
}
