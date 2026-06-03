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
    // 1. Effectifs
    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const totalStaff = staff.length;
    const totalTeachers = staff.filter(s => s.roleType === 'TEACHER').length;
    const totalAdmin = staff.filter(s => s.roleType === 'ADMIN').length;

    // 2. Masse salariale (dernier lot validé ou payé)
    const latestPayroll = await this.prisma.payroll.findFirst({
      where: { tenantId, academicYearId, status: { in: ['VALIDATED', 'PAID'] } },
      orderBy: { endDate: 'desc' },
    });

    let monthlyPayroll = 0;
    let cnssCharges = 0;

    if (latestPayroll) {
      monthlyPayroll = Number(latestPayroll.totalAmount);

      // Récupérer la CNSS via les items
      const items = await this.prisma.payrollItem.findMany({
        where: { payrollId: latestPayroll.id },
      });
      cnssCharges = items.reduce(
        (sum, item) => sum + Number(item.cnssEmployer || 0) + Number(item.cnssEmployee || 0),
        0,
      );
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
