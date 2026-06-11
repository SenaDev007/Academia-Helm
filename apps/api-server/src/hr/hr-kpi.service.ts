/**
 * ============================================================================
 * HR KPI SERVICE - MODULE 5 (v2 — SCHEMA-ALIGNED)
 * ============================================================================
 *
 * Service pour la gestion des KPIs RH (Analytics)
 * Aligné sur les modèles Prisma réels.
 *
 * Modèles utilisés:
 *  - Staff (roleType, pas category)
 *  - Payroll (batch mensuel avec totalAmount)
 *  - PayrollItem (lignes individuelles)
 *  - LeaveRequest (congés, pas leave)
 *
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HrKpiService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule un snapshot KPI RH
   */
  async generateSnapshot(tenantId: string, academicYearId: string) {
    // 1. Effectifs — use groupBy instead of loading all staff into memory
    const [totalCount, roleGroups] = await Promise.all([
      this.prisma.staff.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.staff.groupBy({
        by: ['roleType'],
        where: { tenantId, status: 'ACTIVE' },
        _count: true,
      }),
    ]);

    const totalStaff = totalCount;
    let totalTeachers = 0;
    let totalAdmin = 0;
    for (const g of roleGroups) {
      if (g.roleType === 'TEACHER') totalTeachers = g._count;
      if (g.roleType === 'ADMIN') totalAdmin = g._count;
    }

    // 2. Masse salariale (dernier lot validé ou payé)
    const latestPayroll = await this.prisma.payroll.findFirst({
      where: { tenantId, academicYearId, status: { in: ['VALIDATED', 'PAID'] } },
      orderBy: { endDate: 'desc' },
    });

    let monthlyPayroll = 0;
    let cnssCharges = 0;

    if (latestPayroll) {
      monthlyPayroll = Number(latestPayroll.totalAmount);

      // Récupérer la CNSS via aggregate instead of loading all items
      const cnssStats = await this.prisma.payrollItem.aggregate({
        where: { payrollId: latestPayroll.id },
        _sum: { cnssEmployer: true, cnssEmployee: true },
      });
      cnssCharges = Number(cnssStats._sum.cnssEmployer ?? 0) + Number(cnssStats._sum.cnssEmployee ?? 0);
    }

    // 3. Congés actifs (LeaveRequest)
    const leaveCount = await this.prisma.leaveRequest.count({
      where: {
        tenantId,
        academicYearId,
        status: 'APPROVED',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    return {
      totalStaff,
      totalTeachers,
      totalAdmin,
      monthlyPayroll,
      cnssCharges,
      leaveCount,
      calculatedAt: new Date(),
    };
  }

  /**
   * Récupère l'évolution de la masse salariale (6 derniers mois)
   */
  async getPayrollEvolution(tenantId: string, academicYearId: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { tenantId, academicYearId },
      orderBy: { startDate: 'asc' },
      take: 6,
    });

    return payrolls.map(p => ({
      month: p.month,
      total: Number(p.totalAmount),
    }));
  }

  /**
   * Récupère la répartition par roleType (pas category)
   */
  async getStaffDistribution(tenantId: string) {
    const groups = await this.prisma.staff.groupBy({
      by: ['roleType'],
      where: { tenantId, status: 'ACTIVE' },
      _count: true,
    });

    return groups.map(g => ({
      roleType: g.roleType,
      count: g._count,
    }));
  }
}
