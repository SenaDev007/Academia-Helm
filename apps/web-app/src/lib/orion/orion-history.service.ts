/**
 * ORION History Service
 * 
 * Service pour journaliser les analyses ORION
 * 
 * CONTRAINTES :
 * - Journalisation complète de toutes les interactions
 * - Traçabilité des données sources
 * - Conservation pour audit
 */

import type { OrionAnalysisHistory, OrionResponse, OrionMonthlySummary } from '@/types';

import { getApiBaseUrl } from '@/lib/utils/urls';
import { fetchWithTimeout, LOG_FETCH_TIMEOUT } from '@/lib/api/fetch-with-timeout';

/**
 * Journalise une requête ORION
 */
export async function logOrionQuery(
  tenantId: string,
  userId: string,
  query: string,
  response: OrionResponse
): Promise<void> {
  const API_URL = getApiBaseUrl();
  const historyEntry: Omit<OrionAnalysisHistory, 'id' | 'createdAt'> = {
    tenantId,
    userId,
    type: 'QUERY',
    content: {
      title: `Requête : ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`,
      facts: response.answer.facts,
      interpretation: response.answer.interpretation,
      vigilance: response.answer.vigilance || undefined,
    },
    dataSources: response.dataSources,
  };

  try {
    await fetchWithTimeout(`${API_URL}/orion/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(historyEntry),
    }, LOG_FETCH_TIMEOUT);
  } catch (error) {
    console.error('Erreur journalisation requête ORION:', error);
    // Ne pas faire échouer la requête si la journalisation échoue
  }
}

/**
 * Journalise un résumé mensuel ORION
 */
export async function logOrionSummary(
  tenantId: string,
  summary: OrionMonthlySummary
): Promise<void> {
  const API_URL = getApiBaseUrl();
  const historyEntry: Omit<OrionAnalysisHistory, 'id' | 'createdAt'> = {
    tenantId,
    userId: 'system', // Généré automatiquement
    type: 'MONTHLY_SUMMARY',
    content: {
      title: `Résumé mensuel ${summary.period}`,
      facts: [
        `Élèves : ${summary.facts.academic.totalStudents}`,
        `Recettes : ${summary.facts.financial.totalRevenue.toLocaleString()} ${summary.kpiData.currency}`,
        `Taux recouvrement : ${summary.facts.financial.recoveryRate}%`,
      ],
      interpretation: summary.interpretation.overview,
      vigilance: summary.vigilance.length > 0 
        ? `${summary.vigilance.length} point(s) de vigilance détecté(s)`
        : undefined,
    },
    dataSources: summary.vigilance.map(alert => ({
      kpi: alert.dataSources[0]?.kpi || 'unknown',
      value: alert.dataSources[0]?.value || 0,
      period: alert.dataSources[0]?.period || summary.period,
      source: 'DirectionKpiSummary' as const,
    })),
  };

  try {
    await fetchWithTimeout(`${API_URL}/orion/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(historyEntry),
    }, LOG_FETCH_TIMEOUT);
  } catch (error) {
    console.error('Erreur journalisation résumé ORION:', error);
  }
}

/**
 * Journalise une alerte ORION
 */
export async function logOrionAlert(
  tenantId: string,
  alert: { id: string; title: string; level: string }
): Promise<void> {
  const API_URL = getApiBaseUrl();
  const historyEntry: Omit<OrionAnalysisHistory, 'id' | 'createdAt'> = {
    tenantId,
    userId: 'system',
    type: 'ALERT',
    content: {
      title: `Alerte ${alert.level} : ${alert.title}`,
      facts: [],
      interpretation: `Alerte ${alert.level} générée automatiquement`,
    },
    dataSources: [],
  };

  try {
    await fetchWithTimeout(`${API_URL}/orion/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(historyEntry),
    }, LOG_FETCH_TIMEOUT);
  } catch (error) {
    console.error('Erreur journalisation alerte ORION:', error);
  }
}
