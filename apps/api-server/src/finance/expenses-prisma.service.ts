/**
 * ============================================================================
 * EXPENSES PRISMA SERVICE - MODULE 4
 * ============================================================================
 * 
 * Service pour la gestion des dépenses et catégories de dépenses
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ExpensesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // EXPENSE CATEGORIES
  // ============================================================================

  /**
   * Crée une catégorie de dépense
   */
  async createExpenseCategory(data: {
    tenantId: string;
    name: string;
    description?: string;
    code?: string;
    parentId?: string;
    academicYearId?: string;
    schoolLevelId?: string;
  }) {
    // Vérifier l'unicité du code si fourni
    if (data.code) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: {
          tenantId: data.tenantId,
          code: data.code,
        },
      });

      if (existing) {
        throw new BadRequestException(`Expense category with code ${data.code} already exists`);
      }
    }

    // Vérifier que le parent existe si fourni
    if (data.parentId) {
      const parent = await this.prisma.expenseCategory.findFirst({
        where: {
          id: data.parentId,
          tenantId: data.tenantId,
        },
      });

      if (!parent) {
        throw new NotFoundException(`Parent expense category with ID ${data.parentId} not found`);
      }
    }

    return this.prisma.expenseCategory.create({
      data,
      include: {
        parent: true,
        children: true,
      },
    });
  }

  /**
   * Récupère toutes les catégories de dépenses
   */
  async findAllExpenseCategories(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      parentId?: string;
      isActive?: boolean;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    // Niveau scolaire : filtrer sauf en mode 'ALL'
    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.expenseCategory.findMany({
      where,
      include: {
        parent: true,
        children: true,
        _count: {
          select: {
            expenses: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Récupère une catégorie par ID
   */
  async findExpenseCategoryById(id: string, tenantId: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: true,
        expenses: {
          take: 10,
          orderBy: { expenseDate: 'desc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Expense category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Met à jour une catégorie de dépense
   */
  async updateExpenseCategory(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
      code?: string;
      isActive?: boolean;
    }
  ) {
    const category = await this.findExpenseCategoryById(id, tenantId);

    return this.prisma.expenseCategory.update({
      where: { id },
      data,
      include: {
        parent: true,
        children: true,
      },
    });
  }

  // ============================================================================
  // EXPENSES
  // ============================================================================

  /**
   * Crée une dépense
   */
  async createExpense(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId: string;
    category: string;
    description: string;
    amount: number;
    expenseDate: Date;
    paymentMethod?: string;
    reference?: string;
    attachmentUrl?: string;
    createdBy?: string;
  }) {
    // Vérifier que la catégorie existe
    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        id: data.category,
        tenantId: data.tenantId,
      },
    });

    if (!category) {
      throw new NotFoundException(`Expense category with ID ${data.category} not found`);
    }

    return this.prisma.expense.create({
      data: {
        ...data,
        status: 'pending',
      },
      include: {
        approver: true,
        creator: true,
      },
    });
  }

  /**
   * Récupère toutes les dépenses
   */
  async findAllExpenses(
    tenantId: string,
    filters?: {
      academicYearId?: string;
      schoolLevelId?: string;
      category?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      search?: string;
    }
  ) {
    const where: any = {
      tenantId,
    };

    if (filters?.academicYearId) {
      where.academicYearId = filters.academicYearId;
    }

    if (filters?.schoolLevelId && filters.schoolLevelId !== 'ALL') {
      where.schoolLevelId = filters.schoolLevelId;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.expenseDate = {};
      if (filters.startDate) {
        where.expenseDate.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.expenseDate.lte = filters.endDate;
      }
    }

    if (filters?.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { reference: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        approver: true,
        creator: true,
      },
      orderBy: {
        expenseDate: 'desc',
      },
    });
  }

  /**
   * Récupère une dépense par ID
   */
  async findExpenseById(id: string, tenantId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: {
        approver: true,
        creator: true,
      },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  /**
   * Met à jour une dépense
   */
  async updateExpense(
    id: string,
    tenantId: string,
    data: {
      category?: string;
      description?: string;
      amount?: number;
      expenseDate?: Date;
      paymentMethod?: string;
      reference?: string;
      attachmentUrl?: string;
    }
  ) {
    const expense = await this.findExpenseById(id, tenantId);

    // Vérifier que la dépense n'est pas déjà approuvée
    if (expense.status === 'approved') {
      throw new BadRequestException('Cannot update an approved expense');
    }

    return this.prisma.expense.update({
      where: { id },
      data,
      include: {
        approver: true,
        creator: true,
      },
    });
  }

  /**
   * Approuve une dépense
   */
  async approveExpense(id: string, tenantId: string, approvedBy: string) {
    const expense = await this.findExpenseById(id, tenantId);

    if (expense.status === 'approved') {
      throw new BadRequestException('Expense is already approved');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      },
      include: {
        approver: true,
        creator: true,
      },
    });
  }

  /**
   * Rejette une dépense
   */
  async rejectExpense(id: string, tenantId: string) {
    const expense = await this.findExpenseById(id, tenantId);

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: null,
        approvedAt: null,
      },
      include: {
        approver: true,
        creator: true,
      },
    });
  }

  /**
   * Récupère les statistiques des dépenses
   */
  async getExpenseStatistics(
    tenantId: string,
    academicYearId?: string,
    schoolLevelId?: string
  ) {
    const where: any = {
      tenantId,
      status: 'approved',
    };

    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    const [totalExpenses, byCategory, byMonth] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: {
          amount: true,
        },
        _count: true,
      }),
      this.prisma.expense.findMany({
        where,
        select: {
          amount: true,
          expenseDate: true,
        },
        orderBy: {
          expenseDate: 'desc',
        },
        take: 100,
      }),
    ]);

    return {
      totals: {
        totalAmount: Number(totalExpenses._sum.amount || 0),
        count: totalExpenses._count,
      },
      byCategory,
      recentExpenses: byMonth,
    };
  }
}

