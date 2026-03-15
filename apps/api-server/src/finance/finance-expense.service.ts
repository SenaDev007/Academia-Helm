/**
 * SOUS-MODULE 5 — Dépenses & Budget (FinanceExpense, FinanceBudget)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ExpenseStatus, Prisma } from '@prisma/client';

@Injectable()
export class FinanceExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    data: {
      academicYearId: string;
      categoryId: string;
      amount: number;
      description: string;
      receiptUrl?: string;
      requestedById: string;
    },
    receiptThreshold?: number | null,
  ) {
    if (receiptThreshold != null && data.amount >= receiptThreshold && !data.receiptUrl) {
      throw new BadRequestException(
        'Justificatif obligatoire pour les depenses au-dessus du seuil configure',
      );
    }
    const year = await this.prisma.academicYear.findFirst({
      where: { id: data.academicYearId, tenantId },
    });
    if (!year) throw new NotFoundException('Annee scolaire introuvable');
    if (year.isClosed) throw new BadRequestException('Annee scolaire cloturee');

    const created = await this.prisma.financeExpense.create({
      data: {
        tenantId,
        academicYearId: data.academicYearId,
        categoryId: data.categoryId,
        amount: new Prisma.Decimal(data.amount),
        description: data.description,
        receiptUrl: data.receiptUrl ?? null,
        status: 'PENDING',
        requestedById: data.requestedById,
      },
      include: { category: true, requester: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: created.id,
        action: 'CREATE',
        newValue: { amount: data.amount, categoryId: data.categoryId, description: data.description },
        performedById: data.requestedById,
      },
    });
    return created;
  }

  async findAll(
    tenantId: string,
    filters: {
      academicYearId: string;
      categoryId?: string;
      status?: ExpenseStatus | string;
      from?: string;
      to?: string;
    },
  ) {
    const where: Record<string, unknown> = { tenantId, academicYearId: filters.academicYearId };
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Record<string, Date>).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Record<string, Date>).lte = new Date(filters.to);
    }
    return this.prisma.financeExpense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        requester: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const e = await this.prisma.financeExpense.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        requester: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!e) throw new NotFoundException('Depense introuvable');
    return e;
  }

  async approve(id: string, tenantId: string, approvedById: string) {
    const e = await this.findOne(id, tenantId);
    if (e.status !== 'PENDING') throw new BadRequestException('Depense deja traitee');
    const amount = Number(e.amount);
    const { overrun } = await this.checkOverrun(tenantId, e.academicYearId, e.categoryId, amount);
    if (overrun) {
      await this.prisma.financialAnomaly.create({
        data: {
          tenantId,
          type: 'BUDGET_OVERRUN',
          severity: 'HIGH',
          referenceId: e.id,
        },
      });
    }
    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: id,
        action: 'APPROVE',
        newValue: { status: 'APPROVED', approvedById, approvedAt: new Date() },
        performedById: approvedById,
      },
    });
    return this.prisma.financeExpense.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date() },
      include: { category: true, approver: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async reject(id: string, tenantId: string, approvedById: string) {
    const e = await this.findOne(id, tenantId);
    if (e.status !== 'PENDING') throw new BadRequestException('Depense deja traitee');
    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: id,
        action: 'REJECT',
        oldValue: { status: e.status },
        newValue: { status: 'REJECTED', approvedById },
        performedById: approvedById,
      },
    });
    return this.prisma.financeExpense.update({
      where: { id },
      data: { status: 'REJECTED', approvedById, approvedAt: new Date() },
      include: { category: true },
    });
  }

  async getBudgets(tenantId: string, academicYearId: string) {
    const budgets = await this.prisma.financeBudget.findMany({
      where: { tenantId, academicYearId },
      include: { category: { select: { id: true, name: true } } },
    });
    const spent = await this.prisma.financeExpense.groupBy({
      by: ['categoryId'],
      where: { tenantId, academicYearId, status: 'APPROVED' },
      _sum: { amount: true },
    });
    const spentByCat: Record<string, number> = {};
    spent.forEach((s) => { spentByCat[s.categoryId] = Number(s._sum.amount ?? 0); });
    return budgets.map((b) => ({
      ...b,
      spent: spentByCat[b.categoryId] ?? 0,
      remaining: Number(b.allocatedAmount) - (spentByCat[b.categoryId] ?? 0),
      percentUsed: Number(b.allocatedAmount) > 0
        ? Math.round(((spentByCat[b.categoryId] ?? 0) / Number(b.allocatedAmount)) * 100)
        : 0,
    }));
  }

  async setBudget(
    tenantId: string,
    academicYearId: string,
    categoryId: string,
    allocatedAmount: number,
  ) {
    return this.prisma.financeBudget.upsert({
      where: { tenantId_academicYearId_categoryId: { tenantId, academicYearId, categoryId } },
      create: { tenantId, academicYearId, categoryId, allocatedAmount: new Prisma.Decimal(allocatedAmount) },
      update: { allocatedAmount: new Prisma.Decimal(allocatedAmount) },
      include: { category: true },
    });
  }

  async checkOverrun(
    tenantId: string,
    academicYearId: string,
    categoryId: string,
    amount: number,
  ): Promise<{ overrun: boolean; allocated: number; spent: number }> {
    const budget = await this.prisma.financeBudget.findUnique({
      where: { tenantId_academicYearId_categoryId: { tenantId, academicYearId, categoryId } },
    });
    if (!budget) return { overrun: false, allocated: 0, spent: 0 };
    const spent = await this.prisma.financeExpense.aggregate({
      where: { tenantId, academicYearId, categoryId, status: 'APPROVED' },
      _sum: { amount: true },
    });
    const totalSpent = Number(spent._sum.amount ?? 0) + amount;
    const allocated = Number(budget.allocatedAmount);
    return {
      overrun: totalSpent > allocated,
      allocated,
      spent: Number(spent._sum.amount ?? 0),
    };
  }
}
