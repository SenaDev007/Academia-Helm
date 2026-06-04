/**
 * ============================================================================
 * AUTOMATION PRISMA CONTROLLER - MODULE 6
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AutomationPrismaService } from './automation-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('communication/automation')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AutomationPrismaController {
  constructor(private readonly automationService: AutomationPrismaService) {}

  @Post()
  async createTrigger(@GetTenant() tenant: any, @Body() data: any) {
    return this.automationService.createTrigger(tenant.id, data);
  }

  @Get()
  async findAllTriggers(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('schoolLevelId') schoolLevelId?: string,
    @Query('triggerType') triggerType?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.automationService.findAllTriggers(tenant.id, {
      academicYearId,
      schoolLevelId,
      triggerType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('type/:triggerType')
  async findActiveTriggersByType(@GetTenant() tenant: any, @Param('triggerType') triggerType: string) {
    return this.automationService.findActiveTriggersByType(tenant.id, triggerType);
  }

  @Get(':id')
  async findTriggerById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.automationService.findTriggerById(tenant.id, id);
  }

  @Put(':id')
  async updateTrigger(@GetTenant() tenant: any, @Param('id') id: string, @Body() data: any) {
    return this.automationService.updateTrigger(tenant.id, id, data);
  }

  @Put(':id/toggle')
  async toggleTrigger(@GetTenant() tenant: any, @Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.automationService.toggleTrigger(tenant.id, id, body.isActive);
  }

  @Post(':id/execute')
  async recordTriggerExecution(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.automationService.recordTriggerExecution(id);
  }

  @Delete(':id')
  async deleteTrigger(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.automationService.deleteTrigger(tenant.id, id);
  }
}

