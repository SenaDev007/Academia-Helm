/**
 * ============================================================================
 * LEAVES PRISMA CONTROLLER - MODULE 5
 * ============================================================================
 */

import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LeavesPrismaService } from './leaves-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('api/hr/leaves')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LeavesPrismaController {
  constructor(private readonly leavesService: LeavesPrismaService) {}

  @Post('requests')
  async createLeaveRequest(@GetTenant() tenant: any, @Body() data: any) {
    return this.leavesService.createLeaveRequest({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get('requests')
  async findAllLeaveRequests(
    @GetTenant() tenant: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.leavesService.findAllLeaveRequests(tenant.id, {
      academicYearId,
      staffId,
      status,
      type,
    });
  }

  @Put('requests/:id/process')
  async processLeaveRequest(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED', approvedBy?: string },
  ) {
    return this.leavesService.processLeaveRequest(id, tenant.id, body.status, body.approvedBy);
  }

  @Post('absences')
  async recordAbsence(@GetTenant() tenant: any, @Body() data: any) {
    return this.leavesService.recordAbsence({
      ...data,
      tenantId: tenant.id,
    });
  }

  @Get('staff/:staffId/balance')
  async getLeaveBalance(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.leavesService.calculateLeaveBalance(staffId, tenant.id);
  }
}
