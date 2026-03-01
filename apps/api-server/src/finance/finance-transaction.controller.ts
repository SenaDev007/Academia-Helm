/**
 * SOUS-MODULE 3 — Encaissements (FinanceTransaction) — API
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanceTransactionService } from './finance-transaction.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/transactions')
@UseGuards(JwtAuthGuard)
export class FinanceTransactionController {
  constructor(private readonly service: FinanceTransactionService) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: {
      academicYearId: string;
      studentAccountId: string;
      amount: number;
      paymentMethod: string;
      reference?: string;
      deviceId?: string;
      receiptUrl?: string;
    },
  ) {
    return this.service.create(tenantId, {
      academicYearId: body.academicYearId,
      studentAccountId: body.studentAccountId,
      amount: Number(body.amount),
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      cashierId: user?.id ?? '',
      deviceId: body.deviceId,
      receiptUrl: body.receiptUrl,
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('studentAccountId') studentAccountId?: string,
    @Query('type') type?: string,
  ) {
    return this.service.findAll(tenantId, {
      academicYearId,
      studentAccountId,
      type,
    });
  }

  @Post(':id/reverse')
  async reverse(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { reason: string },
  ) {
    return this.service.reverse(
      id,
      tenantId,
      body?.reason ?? 'Non précisé',
      user?.id ?? '',
    );
  }
}
