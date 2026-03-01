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
    const tauxRecouvrement = due > 0 ? Math.round((paid / due) * 100) : 0;
    return {
      totalDue: due,
      totalPaid: paid,
      totalEncaissement: encaissement,
      totalDepenses: depenses,
      tauxRecouvrement,
    };
  }

  async logExport(tenantId: string, academicYearId: string, reportType: string, generatedById: string) {
    return this.prisma.financialReportExport.create({
      data: { tenantId, academicYearId, reportType, generatedById },
    });
  }
}
