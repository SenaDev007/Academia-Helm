import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ExpensesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(expenseData: any): Promise<any> {
    return this.prisma.expense.create({ data: expenseData });
  }

  async findOne(id: string, tenantId: string): Promise<any | null> {
    return this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: { approver: true, creator: true },
    });
  }

  async findAll(tenantId: string, category?: string, status?: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const where: any = { tenantId };

    if (category) {
      where.category = category;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) {
        where.expenseDate.gte = startDate;
      }
      if (endDate) {
        where.expenseDate.lte = endDate;
      }
    }

    return this.prisma.expense.findMany({
      where,
      include: { approver: true, creator: true },
      orderBy: { expenseDate: 'desc' },
    });
  }

  async update(id: string, tenantId: string, expenseData: any): Promise<any> {
    await this.prisma.expense.updateMany({
      where: { id, tenantId },
      data: expenseData,
    });
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await this.prisma.expense.deleteMany({
      where: { id, tenantId },
    });
  }
}
