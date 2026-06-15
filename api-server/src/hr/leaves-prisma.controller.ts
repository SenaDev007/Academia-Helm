/**
 * ============================================================================
 * LEAVES PRISMA CONTROLLER - MODULE 5 (SCHEMA-ALIGNED v2)
 * ============================================================================
 *
 * Controller aligné sur le service LeavesPrismaService réécrit.
 * Utilise le modèle LeaveRequest.
 * Les endpoints d'absence ont été retirés (le modèle Absence concerne les étudiants).
 *
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { LeavesPrismaService } from './leaves-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { CreateLeaveRequestDto, ProcessLeaveRequestDto } from './dto';

@Controller('hr/leaves')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LeavesPrismaController {
  constructor(private readonly leavesService: LeavesPrismaService) {}

  @Post('requests')
  async createLeaveRequest(
    @GetTenant() tenant: any,
    @Body() data: CreateLeaveRequestDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.leavesService.createLeaveRequest({
      ...data,
      tenantId: tid,
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
    return this.leavesService.findAllLeaveRequests(tenant?.id, {
      academicYearId,
      staffId,
      status,
      type,
    });
  }

  @Get('requests/:id')
  async findLeaveRequestById(@GetTenant() tenant: any, @Param('id') id: string) {
    return this.leavesService.findLeaveRequestById(id, tenant?.id);
  }

  @Put('requests/:id/process')
  async processLeaveRequest(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Body() body: ProcessLeaveRequestDto,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.leavesService.processLeaveRequest(
      id, tid, body.status, body.approvedBy, body.rejectedReason,
    );
  }

  @Delete('requests/:id')
  async deleteLeaveRequest(
    @GetTenant() tenant: any,
    @Param('id') id: string,
    @Query('tenantId') tenantIdFallback?: string,
  ) {
    const tid = tenant?.id ?? tenantIdFallback;
    if (!tid) {
      throw new BadRequestException('Tenant ID requis pour cette opération');
    }
    return this.leavesService.deleteLeaveRequest(id, tid);
  }

  @Get('staff/:staffId/balance')
  async getLeaveBalance(@GetTenant() tenant: any, @Param('staffId') staffId: string) {
    return this.leavesService.calculateLeaveBalance(staffId, tenant?.id);
  }
}
