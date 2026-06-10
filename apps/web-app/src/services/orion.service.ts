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

import { offlineFetch, offlineMutation } from '@/lib/offline/offline-fetch';
import type {
  OrionQueryRequest,
  OrionResponse,
  OrionMonthlySummary,
  OrionAlert,
  OrionAnalysisHistory,
  OrionConfig,
} from '@/types';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Pose une question à ORION
 * 
 * ORION répond uniquement avec des faits basés sur les données réelles
 * Aucune supposition, aucun conseil non factuel
 */
export async function askOrion(request: OrionQueryRequest): Promise<OrionResponse> {
  const result = await offlineMutation<OrionResponse>('/orion/query', 'POST', request, {
    tenantId: getTenantId(),
  });
  if (result.error) throw new Error(result.error);
  return result.data!;
}

/**
 * Récupère le résumé mensuel ORION
 * 
 * Résumé structuré : Faits, Interprétation, Vigilance
 */
export async function getOrionMonthlySummary(period?: string): Promise<OrionMonthlySummary> {
  const params = period ? `?period=${encodeURIComponent(period)}` : '';
  return offlineFetch<OrionMonthlySummary>(`/orion/monthly-summary${params}`, 'orion_cache', {
    tenantId: getTenantId(),
  });
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

  const qs = new URLSearchParams(requestParams).toString();
  return offlineFetch<OrionAlert[]>(`/orion/alerts${qs ? `?${qs}` : ''}`, 'orion_alerts', {
    tenantId: getTenantId(),
  });
}

/**
 * Acquitte une alerte ORION
 */
export async function acknowledgeOrionAlert(alertId: string): Promise<void> {
  const result = await offlineMutation(`/orion/alerts/${alertId}/acknowledge`, 'POST', undefined, {
    tenantId: getTenantId(),
  });
  if (result.error) throw new Error(result.error);
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
  const requestParams: Record<string, any> = { limit };
  if (filters?.type) requestParams.type = filters.type;
  if (filters?.startDate) requestParams.startDate = filters.startDate;
  if (filters?.endDate) requestParams.endDate = filters.endDate;

  const qs = new URLSearchParams(requestParams).toString();
  return offlineFetch<OrionAnalysisHistory[]>(`/orion/history?${qs}`, 'orion_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Récupère la configuration ORION
 */
export async function getOrionConfig(): Promise<OrionConfig> {
  return offlineFetch<OrionConfig>('/orion/config', 'orion_cache', {
    tenantId: getTenantId(),
  });
}

/**
 * Met à jour la configuration ORION
 */
export async function updateOrionConfig(config: Partial<OrionConfig>): Promise<OrionConfig> {
  const result = await offlineMutation<OrionConfig>('/orion/config', 'PUT', config, {
    tenantId: getTenantId(),
  });
  if (result.error) throw new Error(result.error);
  return result.data!;
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
