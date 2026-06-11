/**
 * ORION Monthly Summary API Route
 * 
 * Génère ou récupère le résumé mensuel ORION
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { OrionMonthlySummary } from '@/types';
import {
  loadFinancialKpi,
  loadHrKpi,
  loadPedagogyKpi,
  loadSystemHealthKpi,
  loadDirectionKpi,
  loadPreviousPeriodKpi,
} from '@/lib/orion/orion-kpi.service';
import { executeOrionRules } from '@/lib/orion/orion-rule-engine';
import { generateOrionSummary } from '@/lib/orion/orion-llm.service';
import { logOrionSummary } from '@/lib/orion/orion-history.service';

/**
 * GET /api/orion/monthly-summary
 * 
 * Génère ou récupère le résumé mensuel
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Vérifier l'authentification et le rôle
    const tenantId = request.headers.get('X-Tenant-ID') || '';
    const period = request.nextUrl.searchParams.get('period') || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    // COUCHE 1 : DONNÉES - Charger depuis les tables IA
    const [financialKpi, hrKpi, pedagogyKpis, systemHealthKpi] = await Promise.all([
      loadFinancialKpi(tenantId, period),
      loadHrKpi(tenantId, period),
      loadPedagogyKpi(tenantId),
      loadSystemHealthKpi(tenantId, period),
    ]);

    const kpiData = await loadDirectionKpi(tenantId, period);
    const previousKpiData = period ? await loadPreviousPeriodKpi(tenantId, period) : null;

    // COUCHE 2 : LOGIQUE - Exécuter les règles depuis JSON
    const alerts = await executeOrionRules(
      '1.0',
      financialKpi,
      hrKpi,
      pedagogyKpis,
      systemHealthKpi
    );

    // COUCHE 3 : INTERPRÉTATION
    const summary = await generateOrionSummary(
      kpiData,
      previousKpiData,
      alerts,
      financialKpi,
      hrKpi
    );

    // Construire le résumé mensuel ORION
    const monthlySummary: OrionMonthlySummary = {
      id: `summary_${Date.now()}`,
      tenantId,
      period: period || kpiData.periodLabel,
      facts: {
        financial: {
          totalRevenue: kpiData.totalRevenue,
          recoveryRate: kpiData.recoveryRate,
          pendingPayments: 0, // TODO: Calculer depuis les vues agrégées
          pendingAmount: 0, // TODO: Calculer depuis les vues agrégées
        },
        academic: {
          totalStudents: kpiData.totalStudents,
          totalClasses: 0, // TODO: Depuis les vues agrégées
          averageAttendance: 0, // TODO: Calculer depuis les vues agrégées
          examsCompleted: 0, // TODO: Depuis les vues agrégées
        },
        operational: {
          totalTeachers: kpiData.totalTeachers,
          teacherPresenceRate: kpiData.teacherPresenceRate,
          activeModules: 15, // Tous les modules sont actifs
        },
      },
      interpretation: {
        overview: summary.overview,
        trends: summary.trends,
        highlights: summary.highlights,
      },
      vigilance: alerts,
      kpiData,
      generatedAt: new Date().toISOString(),
    };

    // Journaliser
    await logOrionSummary(tenantId, monthlySummary);

    return NextResponse.json(monthlySummary, { status: 200 });
  } catch (error: any) {
    console.error('ORION monthly summary error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la génération du résumé mensuel' },
      { status: 500 }
    );
  }
}

