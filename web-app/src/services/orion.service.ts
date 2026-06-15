/**
 * ORION Service
 * 
 * Service pour ORION, l'assistant de direction institutionnel
 * Architecture en 4 couches respectée strictement
 * 
 * CONTRAINTES ABSOLUES :
 * - 100% lecture seule
 * - Aucune modification de données
 * - Aucune exécution d'action
 * - Uniquement données réelles et agrégées
 */

import apiClient from '@/lib/api/client';
import type {
  OrionQueryRequest,
  OrionResponse,
  OrionMonthlySummary,
  OrionAlert,
  OrionAnalysisHistory,
  OrionConfig,
} from '@/types';

/**
 * Pose une question à ORION
 * 
 * ORION répond uniquement avec des faits basés sur les données réelles
 * Aucune supposition, aucun conseil non factuel
 */
export async function askOrion(request: OrionQueryRequest): Promise<OrionResponse> {
  const response = await apiClient.post<OrionResponse>('/orion/query', request);
  return response.data;
}

/**
 * Récupère le résumé mensuel ORION
 * 
 * Résumé structuré : Faits, Interprétation, Vigilance
 */
export async function getOrionMonthlySummary(period?: string): Promise<OrionMonthlySummary> {
  const params = period ? { period } : {};
  const response = await apiClient.get<OrionMonthlySummary>('/orion/monthly-summary', { params });
  return response.data;
}

/**
 * Récupère les alertes ORION
 * 
 * Alertes hiérarchisées : INFO, ATTENTION, CRITIQUE
 */
export async function getOrionAlerts(
  params?: {
    level?: 'INFO' | 'ATTENTION' | 'CRITIQUE';
    acknowledged?: boolean;
    alertType?: string;
    academicYearId?: string;
  }
): Promise<OrionAlert[]> {
  const requestParams: Record<string, any> = {};
  if (params?.acknowledged !== undefined) {
    requestParams.acknowledged = params.acknowledged;
  } else {
    requestParams.acknowledged = true;
  }
  if (params?.level) requestParams.level = params.level;
  if (params?.alertType) requestParams.alertType = params.alertType;
  if (params?.academicYearId) requestParams.academicYearId = params.academicYearId;
  
  const response = await apiClient.get<OrionAlert[]>('/orion/alerts', { params: requestParams });
  return response.data;
}

/**
 * Acquitte une alerte ORION
 */
export async function acknowledgeOrionAlert(alertId: string): Promise<void> {
  await apiClient.post(`/orion/alerts/${alertId}/acknowledge`);
}

/**
 * Récupère l'historique des analyses ORION
 */
export async function getOrionHistory(
  limit = 50,
  filters?: {
    type?: 'QUERY' | 'MONTHLY_SUMMARY' | 'ALERT';
    startDate?: string;
    endDate?: string;
  }
): Promise<OrionAnalysisHistory[]> {
  const params: Record<string, any> = { limit };
  if (filters?.type) params.type = filters.type;
  if (filters?.startDate) params.startDate = filters.startDate;
  if (filters?.endDate) params.endDate = filters.endDate;

  const response = await apiClient.get<OrionAnalysisHistory[]>('/orion/history', { params });
  return response.data;
}

/**
 * Récupère la configuration ORION
 */
export async function getOrionConfig(): Promise<OrionConfig> {
  const response = await apiClient.get<OrionConfig>('/orion/config');
  return response.data;
}

/**
 * Met à jour la configuration ORION
 */
export async function updateOrionConfig(config: Partial<OrionConfig>): Promise<OrionConfig> {
  const response = await apiClient.put<OrionConfig>('/orion/config', config);
  return response.data;
}

export const orionService = {
  ask: askOrion,
  getMonthlySummary: getOrionMonthlySummary,
  getAlerts: getOrionAlerts,
  acknowledgeAlert: acknowledgeOrionAlert,
  getHistory: getOrionHistory,
  getConfig: getOrionConfig,
  updateConfig: updateOrionConfig,
};

