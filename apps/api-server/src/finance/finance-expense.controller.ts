/**
 * SOUS-MODULE 5 — Dépenses & Budget — API
 */
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanceExpenseService } from './finance-expense.service';
import { FinancialSettingsService } from './financial-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/expenses-v2')
@UseGuards(JwtAuthGuard)
export class FinanceExpenseController {
  constructor(
    private readonly expenseService: FinanceExpenseService,
    private readonly settingsService: FinancialSettingsService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { academicYearId: string; categoryId: string; amount: number; description: string; receiptUrl?: string },
  ) {
    const settings = await this.settingsService.getForTenant(tenantId);
    const threshold = settings?.expenseReceiptThreshold != null ? Number(settings.expenseReceiptThreshold) : null;
    return this.expenseService.create(
      tenantId,
      {
        ...body,
        requestedById: user?.id,
      },
      threshold,
    );
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!academicYearId) return [];
    return this.expenseService.findAll(tenantId, {
      academicYearId,
      categoryId,
      status,
      from,
      to,
    });
  }

  @Get('budgets')
  async getBudgets(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.expenseService.getBudgets(tenantId, academicYearId);
  }

  @Post('budgets')
  async setBudget(
    @TenantId() tenantId: string,
    @Body() body: { academicYearId: string; categoryId: string; allocatedAmount: number },
  ) {
    return this.expenseService.setBudget(
      tenantId,
      body.academicYearId,
      body.categoryId,
      body.allocatedAmount,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.expenseService.findOne(id, tenantId);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @TenantId() tenantId: string, @CurrentUser() user: any) {
    return this.expenseService.approve(id, tenantId, user?.id);
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @TenantId() tenantId: string, @CurrentUser() user: any) {
    return this.expenseService.reject(id, tenantId, user?.id);
  }
}
