/**
 * SOUS-MODULE 6 — Clôture journalière — API
 */
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanceDailyClosureService } from './finance-daily-closure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/daily-closures')
@UseGuards(JwtAuthGuard)
export class FinanceDailyClosureController {
  constructor(private readonly service: FinanceDailyClosureService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!academicYearId) return [];
    return this.service.findClosures(tenantId, academicYearId, from, to);
  }

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; date: string; physicalAmount?: number; validate?: boolean },
  ) {
    const date = new Date(body.date);
    const validate = body.validate === true;
    return this.service.createClosure(
      tenantId,
      body.academicYearId,
      date,
      validate ? user?.id : null,
      body.physicalAmount,
      'MANUAL',
    );
  }

  @Patch(':id/validate')
  async validate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.validateClosure(id, tenantId, user?.id);
  }
}
