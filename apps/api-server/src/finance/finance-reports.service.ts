/**
 * SOUS-MODULE 7 — Rapports & Analytique
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class FinanceReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKpi(tenantId: string, academicYearId: string) {
    const totalDue = await this.prisma.studentAccount.aggregate({
      where: { tenantId, academicYearId },
      _sum: { totalDue: true },
    });
    const totalPaid = await this.prisma.studentAccount.aggregate({
      where: { tenantId, academicYearId },
      _sum: { totalPaid: true },
    });
    const transactionsSum = await this.prisma.financeTransaction.aggregate({
      where: { tenantId, academicYearId, type: 'PAYMENT' },
      _sum: { amount: true },
    });
    const expensesSum = await this.prisma.financeExpense.aggregate({
      where: { tenantId, academicYearId, status: 'APPROVED' },
      _sum: { amount: true },
    });
    const due = Number(totalDue._sum.totalDue ?? 0);
    const paid = Number(totalPaid._sum.totalPaid ?? 0);
    const encaissement = Number(transactionsSum._sum.amount ?? 0);
    const depenses = Number(expensesSum._sum.amount ?? 0);
    const tauxRecouvrement = due > 0 ? Math.round((paid / due) ? (paid / due) * 100 : 0) : 0;
    return {
      totalDue: due,
      totalPaid: paid,
      totalEncaissement: encaissement,
      totalDepenses: depenses,
      tauxRecouvrement,
    };
  }

  /** Encaissements groupés par mois pour l'année scolaire. */
  async getMonthlyEncaissements(tenantId: string, academicYearId: string) {
    // Note: Utilisation de queryRaw pour Group By Month car Prisma aggregate est limité
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT 
        TO_CHAR("createdAt", 'YYYY-MM') as month,
        SUM(amount)::FLOAT as total
      FROM "finance_transactions"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "type" = 'PAYMENT'
      GROUP BY 1
      ORDER BY 1 ASC
    `, tenantId, academicYearId);
    return data;
  }

  /** Encaissements groupés par classe. */
  async getClassEncaissements(tenantId: string, academicYearId: string) {
    // Rejoint StudentAccount -> Student -> Enrollment -> Class
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT 
        c.name as "className",
        SUM(t.amount)::FLOAT as total
      FROM "finance_transactions" t
      JOIN "student_accounts" sa ON t."studentAccountId" = sa.id
      JOIN "students" s ON sa."studentId" = s.id
      JOIN "student_enrollments" se ON s.id = se."studentId" AND se."academicYearId" = t."academicYearId"
      JOIN "classes" c ON se."classId" = c.id
      WHERE t."tenantId" = $1 AND t."academicYearId" = $2 AND t."type" = 'PAYMENT'
      GROUP BY 1
      ORDER BY 2 DESC
    `, tenantId, academicYearId);
    return data;
  }

  /** Dépenses par catégorie. */
  async getExpenseByCategory(tenantId: string, academicYearId: string) {
    const data = await this.prisma.$queryRawUnsafe(`
      SELECT 
        category,
        SUM(amount)::FLOAT as total
      FROM "finance_expenses"
      WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "status" = 'APPROVED'
      GROUP BY 1
      ORDER BY 2 DESC
    `, tenantId, academicYearId);
    return data;
  }

  async logExport(tenantId: string, academicYearId: string, reportType: string, generatedById: string) {
    return this.prisma.financialReportExport.create({
      data: { tenantId, academicYearId, reportType, generatedById },
    });
  }
}
