/**
 * ============================================================================
 * ORION DASHBOARD SERVICE - MODULE 8
 * ============================================================================
 * Service pour agréger les données du dashboard de pilotage direction
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { KPICalculationService } from './kpi-calculation.service';
import { OrionAlertsService } from './orion-alerts.service';
import { OrionInsightsService } from './orion-insights.service';

@Injectable()
export class OrionDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kpiService: KPICalculationService,
    private readonly alertsService: OrionAlertsService,
    private readonly insightsService: OrionInsightsService,
  ) {}

  /**
   * Récupère toutes les données du dashboard pour un tenant
   */
  async getDashboardData(tenantId: string, academicYearId?: string, schoolLevelId?: string) {
    // 1. Calculer les KPIs actuels
    const kpis = await this.kpiService.calculateSystemKPIs(tenantId, academicYearId, schoolLevelId);

    // 2. Récupérer les alertes actives
    const alerts = await this.alertsService.generateAllAlerts(tenantId, academicYearId);

    // 3. Générer les insights
    const insights = await this.insightsService.generateInsights(tenantId, academicYearId, schoolLevelId);

    // 4. Récupérer les statistiques globales
    const stats = await this.getGlobalStats(tenantId, academicYearId, schoolLevelId);

    // 5. Récupérer les KPIs historiques pour tendances
    const kpiSnapshots = await this.kpiService.findKPISnapshots(tenantId, {
      academicYearId,
      schoolLevelId,
      fromDate: new Date(new Date().setMonth(new Date().getMonth() - 6)), // 6 derniers mois
    });

    return {
      kpis,
      alerts: alerts.filter(a => a.severity === 'CRITICAL').slice(0, 10), // Top 10 alertes critiques
      insights: insights.slice(0, 5), // Top 5 insights
      stats,
      trends: this.calculateTrends(kpiSnapshots),
    };
  }

  /**
   * Récupère les statistiques globales
   */
  private async getGlobalStats(tenantId: string, academicYearId?: string, schoolLevelId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    const [
      totalStudents,
      totalStaff,
      totalClasses,
      totalIncidents,
      totalPayments,
      totalExpenses,
    ] = await Promise.all([
      this.prisma.student.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.staff.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.class.count({ where }),
      this.prisma.incident.count({ where: { ...where, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.payment.aggregate({
        where: { tenantId, ...(academicYearId && { academicYearId }), status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { tenantId, ...(academicYearId && { academicYearId }) },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalStudents,
      totalStaff,
      totalClasses,
      totalIncidents,
      totalRevenue: Number(totalPayments._sum.amount || 0),
      totalExpenses: Number(totalExpenses._sum.amount || 0),
      balance: Number(totalPayments._sum.amount || 0) - Number(totalExpenses._sum.amount || 0),
    };
  }

  /**
   * Calcule les tendances à partir des snapshots KPI
   */
  private calculateTrends(snapshots: any[]) {
    const trends: any = {};

    // Grouper par code KPI
    const kpiGroups = snapshots.reduce((acc, snapshot) => {
      const code = snapshot.kpi?.code;
      if (!code) return acc;
      if (!acc[code]) acc[code] = [];
      acc[code].push(snapshot);
      return acc;
    }, {} as Record<string, any[]>);

    // Calculer la tendance pour chaque KPI
    Object.entries(kpiGroups).forEach(([code, values]) => {
      const typedValues = values as any[];
      if (typedValues.length >= 2) {
        const sorted = typedValues.sort((a, b) => 
          new Date(a.computedAt).getTime() - new Date(b.computedAt).getTime()
        );
        const oldest = sorted[0].value;
        const newest = sorted[sorted.length - 1].value;
        const change = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;

        trends[code] = {
          direction: change > 0 ? 'UP' : change < 0 ? 'DOWN' : 'STABLE',
          percentage: Math.abs(change),
          values: sorted.map(v => ({ date: v.computedAt, value: v.value })),
        };
      }
    });

    return trends;
  }

  /**
   * Récupère le résumé exécutif
   */
  async getExecutiveSummary(tenantId: string, academicYearId?: string) {
    const dashboard = await this.getDashboardData(tenantId, academicYearId);

    return {
      summary: {
        totalAlerts: dashboard.alerts.length,
        criticalAlerts: dashboard.alerts.filter(a => a.severity === 'CRITICAL').length,
        totalInsights: dashboard.insights.length,
        keyKPIs: dashboard.kpis.slice(0, 5),
      },
      recommendations: dashboard.insights.map(i => ({
        category: i.category,
        priority: i.priority,
        message: i.content,
      })),
    };
  }
}

