/**
 * ============================================================================
 * SCHEDULING PRISMA CONTROLLER - MODULE 6
 * ============================================================================
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { SchedulingPrismaService } from './scheduling-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';

@Controller('communication/scheduling')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SchedulingPrismaController {
  constructor(private readonly schedulingService: SchedulingPrismaService) {}

  @Post(':messageId')
  async scheduleMessage(@GetTenant() tenant: any, @Param('messageId') messageId: string, @Body() body: { scheduledAt: string }) {
    return this.schedulingService.scheduleMessage(messageId, new Date(body.scheduledAt));
  }

  @Get()
  async findScheduledMessages(
    @GetTenant() tenant: any,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.schedulingService.findScheduledMessages(tenant.id, {
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });
  }

  @Get('pending')
  async findPendingScheduledMessages(@GetTenant() tenant: any) {
    return this.schedulingService.findPendingScheduledMessages(tenant.id);
  }

  @Put(':messageId/status')
  async updateScheduledMessageStatus(
    @GetTenant() tenant: any,
    @Param('messageId') messageId: string,
    @Body() body: { status: string; errorMessage?: string },
  ) {
    return this.schedulingService.updateScheduledMessageStatus(messageId, body.status, body.errorMessage);
  }

  @Put(':messageId/cancel')
  async cancelScheduledMessage(@GetTenant() tenant: any, @Param('messageId') messageId: string) {
    return this.schedulingService.cancelScheduledMessage(messageId);
  }

  @Delete(':messageId')
  async deleteScheduledMessage(@GetTenant() tenant: any, @Param('messageId') messageId: string) {
    return this.schedulingService.deleteScheduledMessage(messageId);
  }
}

