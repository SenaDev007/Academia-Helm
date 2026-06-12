/**
 * Consolidated KPI Service
 * 
 * Service pour récupérer les bilans consolidés multi-écoles
 * Uniquement pour les SUPER_DIRECTOR (promoteurs)
 */

import apiClient from '@/lib/api/client';
import type { ConsolidatedKpiResponse } from '@/types';

/**
 * Récupère les bilans consolidés pour tous les établissements du groupe
 * 
 * @param period - Période de référence (ex: "2024-2025", "2025-01")
 */
export async function getConsolidatedKpi(period?: string): Promise<ConsolidatedKpiResponse> {
  const params = period ? { period } : {};
  
  const response = await apiClient.get<ConsolidatedKpiResponse>('/analytics/consolidated', {
    params,
  });

  return response.data;
}

