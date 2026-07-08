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
      expenseDate?: Date;
      vendor?: string;
      invoiceRef?: string;
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

    // Vérifier le dépassement de budget à la création
    const { overrun } = await this.checkOverrun(tenantId, data.academicYearId, data.categoryId, data.amount);

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
        overBudget: overrun,
        expenseDate: data.expenseDate ?? new Date(),
        vendor: data.vendor ?? null,
        invoiceRef: data.invoiceRef ?? null,
      },
      include: { category: true, requester: { select: { id: true, firstName: true, lastName: true } } },
    });
    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: created.id,
        action: 'CREATE',
        newValue: { amount: data.amount, categoryId: data.categoryId, description: data.description, overBudget: overrun },
        performedById: data.requestedById,
      },
    });

    // Si dépassement de budget → créer une anomalie ORION
    if (overrun) {
      await this.prisma.financialAnomaly.create({
        data: {
          tenantId,
          type: 'BUDGET_OVERRUN',
          severity: 'HIGH',
          referenceId: created.id,
        },
      });
    }

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

  /**
   * Supprime une dépense (uniquement si PENDING).
   * Après approbation/rejet, la suppression est interdite (audit trail).
   */
  async deleteExpense(id: string, tenantId: string) {
    const e = await this.findOne(id, tenantId);
    if (e.status !== 'PENDING') {
      throw new BadRequestException('Suppression interdite : la dépense a déjà été traitée (approuvée ou rejetée).');
    }
    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: id,
        action: 'DELETE',
        oldValue: { status: e.status, amount: Number(e.amount), description: e.description },
        performedById: null,
      },
    });
    await this.prisma.financeExpense.delete({ where: { id } });
    return { success: true, deleted: true };
  }

  async approve(id: string, tenantId: string, approvedById: string, approverRole?: string) {
    const e = await this.findOne(id, tenantId);
    if (e.status !== 'PENDING') throw new BadRequestException('Depense deja traitee');
    const amount = Number(e.amount);
    const { overrun } = await this.checkOverrun(tenantId, e.academicYearId, e.categoryId, amount);

    // ⚠️ RÈGLE 4 — Dépassement budget : validation Promoteur obligatoire
    // Si la dépense dépasse le budget, seul le PROMOTEUR peut approuver
    if (overrun && approverRole && !['PROMOTEUR', 'PROMOTER', 'PLATFORM_OWNER'].includes(approverRole)) {
      throw new BadRequestException(
        'Cette dépense dépasse le budget de sa catégorie. Seul le Promoteur peut l\'approuver.',
      );
    }

    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: id,
        action: 'APPROVE',
        newValue: { status: 'APPROVED', approvedById, approvedAt: new Date(), overBudget: overrun },
        performedById: approvedById,
      },
    });
    return this.prisma.financeExpense.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, approvedAt: new Date(), overBudget: overrun },
      include: { category: true, approver: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async reject(id: string, tenantId: string, approvedById: string, rejectReason?: string) {
    const e = await this.findOne(id, tenantId);
    if (e.status !== 'PENDING') throw new BadRequestException('Depense deja traitee');

    // Le motif de rejet est obligatoire
    if (!rejectReason || !rejectReason.trim()) {
      throw new BadRequestException('Le motif du rejet est obligatoire.');
    }

    await this.prisma.financialAuditLog.create({
      data: {
        tenantId,
        entityType: 'FinanceExpense',
        entityId: id,
        action: 'REJECT',
        oldValue: { status: e.status },
        newValue: { status: 'REJECTED', approvedById, rejectReason },
        performedById: approvedById,
      },
    });
    return this.prisma.financeExpense.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById,
        approvedAt: new Date(),
        rejectReason: rejectReason.trim(),
      },
      include: { category: true, approver: { select: { id: true, firstName: true, lastName: true } } },
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

  /**
   * Supprime un budget (DELETE réel, pas soft delete).
   */
  async deleteBudget(tenantId: string, budgetId: string) {
    const budget = await this.prisma.financeBudget.findFirst({
      where: { id: budgetId, tenantId },
    });
    if (!budget) {
      throw new NotFoundException('Budget introuvable');
    }
    await this.prisma.financeBudget.delete({ where: { id: budgetId } });
    return { success: true, deleted: true };
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

  /**
   * Statistiques mensuelles pour le graphique d'évolution des dépenses.
   * Retourne un tableau de { month, total, count } pour l'année scolaire.
   */
  async getMonthlyStats(tenantId: string, academicYearId: string) {
    const expenses = await this.prisma.financeExpense.findMany({
      where: { tenantId, academicYearId, status: 'APPROVED' },
      select: { amount: true, expenseDate: true },
    });

    // Grouper par mois (format YYYY-MM)
    const byMonth: Record<string, { total: number; count: number }> = {};
    for (const e of expenses) {
      const d = new Date(e.expenseDate);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) byMonth[monthKey] = { total: 0, count: 0 };
      byMonth[monthKey].total += Number(e.amount ?? 0);
      byMonth[monthKey].count += 1;
    }

    // Trier par mois
    return Object.entries(byMonth)
      .map(([month, data]) => ({
        month,
        monthLabel: new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
