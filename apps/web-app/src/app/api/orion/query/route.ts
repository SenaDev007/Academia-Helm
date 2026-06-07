/**
 * ORION Query API Route
 * 
 * Traite une question ORION avec architecture stricte en 4 couches
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { OrionQueryRequest, OrionResponse } from '@/types';
import {
  loadFinancialKpi,
  loadHrKpi,
  loadPedagogyKpi,
  loadSystemHealthKpi,
  loadDirectionKpi,
} from '@/lib/orion/orion-kpi.service';
import { executeOrionRules } from '@/lib/orion/orion-rule-engine';
import { generateOrionResponse } from '@/lib/orion/orion-llm.service';
import { logOrionQuery } from '@/lib/orion/orion-history.service';


/**
 * POST /api/orion/query
 * 
 * Traite une question ORION
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Vérifier l'authentification et le rôle (DIRECTOR, SUPER_DIRECTOR, ADMIN)
    // const session = await getServerSession();
    // if (!session || !['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN'].includes(session.user.role)) {
    //   return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    // }

    const body: OrionQueryRequest = await request.json();
    const tenantId = request.headers.get('X-Tenant-ID') || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    if (!body.query || body.query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question requise' },
        { status: 400 }
      );
    }

    // COUCHE 1 : DONNÉES - Charger les KPI depuis les tables IA uniquement
    const period = body.context?.period;
    
    // Charger tous les KPI depuis les tables dédiées
    const [financialKpi, hrKpi, pedagogyKpis, systemHealthKpi] = await Promise.all([
      loadFinancialKpi(tenantId, period),
      loadHrKpi(tenantId, period),
      loadPedagogyKpi(tenantId),
      loadSystemHealthKpi(tenantId, period),
    ]);

    // Construire DirectionKpiSummary pour compatibilité
    const kpiData = await loadDirectionKpi(tenantId, period);

    // COUCHE 2 : LOGIQUE - Exécuter les règles déterministes depuis JSON
    const alerts = await executeOrionRules(
      '1.0', // Version des règles
      financialKpi,
      hrKpi,
      pedagogyKpis,
      systemHealthKpi
    );

    // COUCHE 3 : INTERPRÉTATION - Générer la réponse via LLM
    const response = await generateOrionResponse(
      body.query,
      kpiData,
      alerts,
      financialKpi,
      hrKpi
    );

    // Construire la réponse ORION
    const orionResponse: OrionResponse = {
      answer: {
        facts: response.facts,
        interpretation: response.interpretation,
        vigilance: response.vigilance || null,
      },
      dataSources: [
        {
          kpi: 'totalRevenue',
          value: kpiData.totalRevenue,
          period: kpiData.periodLabel,
          source: 'DirectionKpiSummary',
        },
        {
          kpi: 'recoveryRate',
          value: kpiData.recoveryRate,
          period: kpiData.periodLabel,
          source: 'DirectionKpiSummary',
        },
      ],
      confidence: response.confidence,
      dataSufficient: response.dataSufficient,
    };

    // Journaliser l'analyse
    const userId = request.headers.get('X-User-ID') || 'unknown';
    await logOrionQuery(tenantId, userId, body.query, orionResponse);

    return NextResponse.json(orionResponse, { status: 200 });
  } catch (error: any) {
    console.error('ORION query error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors du traitement de la requête ORION' },
      { status: 500 }
    );
  }
}

