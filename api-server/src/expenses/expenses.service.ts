import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpensesRepository } from './expenses.repository';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { toDate } from '../common/helpers/date.helper';

@Injectable()
export class ExpensesService {
  constructor(private readonly expensesRepository: ExpensesRepository) {}

  async create(createExpenseDto: CreateExpenseDto, tenantId: string, createdBy?: string): Promise<Expense> {
    const createData: any = {
      ...createExpenseDto,
      tenantId,
      createdBy,
    };
    if (createExpenseDto.expenseDate) {
      createData.expenseDate = toDate(createExpenseDto.expenseDate as any);
    }
    return this.expensesRepository.create(createData);
  }

  async findAll(tenantId: string, category?: string, status?: string, startDate?: Date, endDate?: Date): Promise<Expense[]> {
    return this.expensesRepository.findAll(tenantId, category, status, startDate, endDate);
  }

  async findOne(id: string, tenantId: string): Promise<Expense> {
    const expense = await this.expensesRepository.findOne(id, tenantId);
    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }
    return expense;
  }

  async update(id: string, updateExpenseDto: UpdateExpenseDto, tenantId: string): Promise<Expense> {
    await this.findOne(id, tenantId);
    const updateData: any = { ...updateExpenseDto };
    if (updateExpenseDto.expenseDate !== undefined) {
      updateData.expenseDate = updateExpenseDto.expenseDate ? toDate(updateExpenseDto.expenseDate as any) : null;
    }
    return this.expensesRepository.update(id, tenantId, updateData);
  }

  async approve(id: string, tenantId: string, approvedBy: string): Promise<Expense> {
    await this.findOne(id, tenantId);
    return this.expensesRepository.update(id, tenantId, {
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.findOne(id, tenantId);
    await this.expensesRepository.delete(id, tenantId);
  }
}

