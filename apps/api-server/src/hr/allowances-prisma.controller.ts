/**
 * ============================================================================
 * ALLOWANCES PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AllowancesPrismaService } from './allowances-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('api/hr/allowances')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AllowancesPrismaController {
  constructor(private readonly allowancesService: AllowancesPrismaService) {}

  @Post('types')
  async createAllowanceType(@GetTenant() tenant: any, @Body() data: any) {
    return this.allowancesService.createAllowanceType({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get('types')
  async findAllAllowanceTypes(@GetTenant() tenant: any) {
    return this.allowancesService.findAllAllowanceTypes(tenant.id);
  }

  @Post('assignments')
  async assignAllowanceToStaff(@GetTenant() tenant: any, @Body() data: any) {
    return this.allowancesService.assignAllowanceToStaff({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get('staff/:staffId')
  async findStaffAllowances(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.allowancesService.findStaffAllowances(staffId, tenant.id);
  }

  @Put('assignments/:id')
  async updateStaffAllowance(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: any) {
    return this.allowancesService.updateStaffAllowance(id, tenant.id, data);
  }

  @Delete('assignments/:id')
  async removeStaffAllowance(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.allowancesService.removeStaffAllowance(id, tenant.id);
  }
}
