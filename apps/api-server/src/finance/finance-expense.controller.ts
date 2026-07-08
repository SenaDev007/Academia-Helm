/**
 * SOUS-MODULE 5 — Dépenses & Budget — API
 */
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinanceExpenseService } from './finance-expense.service';
import { FinancialSettingsService } from './financial-settings.service';
import { PrismaService } from '../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateFinanceExpenseDto } from './dto';

@Controller('finance/expenses-v2')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceExpenseController {
  constructor(
    private readonly expenseService: FinanceExpenseService,
    private readonly settingsService: FinancialSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: CreateFinanceExpenseDto & { expenseDate?: string; vendor?: string; invoiceRef?: string; requestedById?: string; pendingApproverId?: string },
  ) {
    const settings = await this.settingsService.getForTenant(tenantId);
    const threshold = settings?.expenseReceiptThreshold != null ? Number(settings.expenseReceiptThreshold) : null;

    // ⚠️ requestedById : utiliser celui du body si fourni, sinon l'utilisateur connecté
    const requestedById = body.requestedById || user?.id;

    // ⚠️ pendingApproverId : celui qui doit approuver (ex: promoteur, directeur)
    // Si non fourni, on le détermine automatiquement (ex: promoteur par défaut)
    let pendingApproverId = body.pendingApproverId;
    if (!pendingApproverId) {
      // Chercher le promoteur du tenant pour l'approbation par défaut
      const promoter = await this.prisma.user.findFirst({
        where: {
          tenantId,
          role: { in: ['PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER'] },
        },
        select: { id: true },
      });
      pendingApproverId = promoter?.id;
    }

    return this.expenseService.create(
      tenantId,
      {
        ...body,
        requestedById,
        pendingApproverId,
        expenseDate: body.expenseDate ? new Date(body.expenseDate) : undefined,
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

  @Get('monthly-stats')
  async getMonthlyStats(
    @TenantId() tenantId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    if (!academicYearId) return [];
    return this.expenseService.getMonthlyStats(tenantId, academicYearId);
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
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
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

  @Delete('budgets/:id')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async deleteBudget(
    @TenantId() tenantId: string,
    @Param('id') budgetId: string,
  ) {
    return this.expenseService.deleteBudget(tenantId, budgetId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.expenseService.findOne(id, tenantId);
  }

  @Delete(':id')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async deleteExpense(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.expenseService.deleteExpense(id, tenantId);
  }

  @Patch(':id/approve')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async approve(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    // user.role est utilisé pour vérifier si le Promoteur est requis en cas de dépassement
    const userRole = user?.role || user?.roles?.[0] || '';
    return this.expenseService.approve(id, tenantId, user?.id, userRole);
  }

  @Patch(':id/reject')
  @Roles('DIRECTOR', 'ADMIN', 'SUPER_DIRECTOR', 'PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER')
  async reject(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() body: { rejectReason?: string },
  ) {
    return this.expenseService.reject(id, tenantId, user?.id, body?.rejectReason);
  }
}
