/**
 * KPI Service
 *
 * Service léger pour récupérer les KPI directionnels (Bilans & Indicateurs).
 * Toutes les agrégations et calculs sont effectués côté backend.
 */

import { apiClient } from '@/lib/api/client';
import type { DirectionKpiResponse } from '@/types';

/**
 * Récupère les KPI directionnels pour le tenant courant.
 *
 * Route backend attendue : GET /analytics/direction
 */
export async function getDirectionKpi(): Promise<DirectionKpiResponse> {
  const response = await apiClient.get<DirectionKpiResponse>('/analytics/direction');
  return response.data;
}


