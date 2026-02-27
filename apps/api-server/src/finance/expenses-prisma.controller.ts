/**
 * ============================================================================
 * EXPENSES PRISMA CONTROLLER - MODULE 4
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ExpensesPrismaService } from './expenses-prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { SchoolLevelId } from '../common/decorators/school-level-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/finance/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesPrismaController {
  constructor(private readonly expensesService: ExpensesPrismaService) {}

  // Expense Categories
  @Post('categories')
  async createCategory(@TenantId() tenantId: string, @Body() createDto: any) {
    return this.expensesService.createExpenseCategory({
      ...createDto,
      tenantId,
    });
  }

  @Get('categories')
  async findAllCategories(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('parentId') parentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.expensesService.findAllExpenseCategories(tenantId, {
      academicYearId,
      schoolLevelId,
      parentId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('categories/:id')
  async findCategoryById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.expensesService.findExpenseCategoryById(id, tenantId);
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.expensesService.updateExpenseCategory(id, tenantId, updateDto);
  }

  // Expenses
  @Post()
  async createExpense(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() createDto: any,
  ) {
    return this.expensesService.createExpense({
      ...createDto,
      tenantId,
      createdBy: user?.id,
    });
  }

  @Get()
  async findAllExpenses(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.expensesService.findAllExpenses(tenantId, {
      academicYearId,
      schoolLevelId,
      category,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      search,
    });
  }

  @Get(':id')
  async findExpenseById(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.expensesService.findExpenseById(id, tenantId);
  }

  @Put(':id')
  async updateExpense(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.expensesService.updateExpense(id, tenantId, updateDto);
  }

  @Put(':id/approve')
  async approveExpense(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.approveExpense(id, tenantId, user?.id);
  }

  @Put(':id/reject')
  async rejectExpense(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.expensesService.rejectExpense(id, tenantId);
  }

  @Get('statistics/summary')
  async getStatistics(
    @TenantId() tenantId: string,
    @SchoolLevelId() schoolLevelId: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.expensesService.getExpenseStatistics(tenantId, academicYearId, schoolLevelId);
  }
}

