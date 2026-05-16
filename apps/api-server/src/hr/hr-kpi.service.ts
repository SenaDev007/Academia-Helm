/**
 * ============================================================================
 * HR KPI SERVICE - MODULE 5 (v2)
 * ============================================================================
 * 
 * Service pour la gestion des snapshots et KPIs RH (Analytics)
 * 
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class HrKpiService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calcule et enregistre un snapshot KPI RH
   */
  async generateSnapshot(tenantId: string, academicYearId: string) {
    // 1. Effectifs
    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const totalStaff = staff.length;
    const totalTeachers = staff.filter(s => s.category === 'PEDAGOGICAL').length;
    const totalAdmin = staff.filter(s => s.category === 'ADMIN').length;

    // 2. Masse salariale (dernier mois validé ou payé)
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
        where: { payrollId: latestPayroll.id }
      });
      cnssCharges = items.reduce((sum, item) => sum + Number(item.cnssEmployer || 0) + Number(item.cnssEmployee || 0), 0);
    }

    // 3. Congés actifs
    const leaveCount = await this.prisma.leave.count({
      where: {
        tenantId,
        academicYearId,
        status: 'APPROVED',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    });

    // 4. Enregistrement du snapshot (HROverviewSnapshot ou HRKpiSnapshot selon le schéma)
    // On va utiliser un retour direct pour le moment si le modèle n'existe pas encore sous ce nom exact
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
   * Récupère la répartition par catégorie
   */
  async getStaffDistribution(tenantId: string) {
    const groups = await this.prisma.staff.groupBy({
      by: ['category'],
      where: { tenantId, status: 'ACTIVE' },
      _count: true,
    });

    return groups.map(g => ({
      category: g.category,
      count: g._count,
    }));
  }
}
