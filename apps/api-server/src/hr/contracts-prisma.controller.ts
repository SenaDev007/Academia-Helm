/**
 * ============================================================================
 * CONTRACTS PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ContractsPrismaService } from './contracts-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('api/hr/contracts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ContractsPrismaController {
  constructor(private readonly contractsService: ContractsPrismaService) {}

  @Post()
  async createContract(@GetTenant() tenant: any, @Body() data: any) {
    return this.contractsService.createContract({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get()
  async findAllContracts(
    @GetTenant() tenant: any,
    @Query('staffId') staffId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.contractsService.findAllContracts(tenant.id, {
      staffId,
      type,
      status,
    });
  }

  @Get(':id')
  async findContractById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.contractsService.findContractById(id, tenant.id);
  }

  @Put(':id')
  async updateContract(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: any) {
    return this.contractsService.updateContract(id, tenant.id, data);
  }

  @Post(':id/amendments')
  async createAmendment(
    @GetTenant() tenant: any,
    @Param('id') contractId: string,
    @Body() data: any,
  ) {
    return this.contractsService.createAmendment({
      ...data,
      tenantId: tenant.id,
      contractId,
    });
  }

  @Put(':id/terminate')
  async terminateContract(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.contractsService.terminateContract(id, tenant.id);
  }

  @Get('staff/:staffId/active')
  async findActiveContract(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.contractsService.findActiveContract(staffId, tenant.id);
  }
}

