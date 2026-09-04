/**
 * Consolidated KPI Service
 *
 * Service pour récupérer les bilans consolidés multi-écoles — la vue
 * stratégique du groupe scolaire. Uniquement pour les promoteurs
 * (PROMOTER / SUPER_DIRECTOR) et les rôles plateforme.
 *
 * Source : GET /api/analytics/consolidated (relais BFF → NestJS
 * /analytics/consolidated — périmètre résolu côté backend depuis le JWT).
 */

import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { ConsolidatedKpiResponse } from '@/types';

/**
 * Récupère les bilans consolidés pour tous les établissements du groupe
 * (KPIs par école + agrégats consolidés sur l'année académique active).
 */
export async function getConsolidatedKpi(): Promise<ConsolidatedKpiResponse> {
  return offlineFetch<ConsolidatedKpiResponse>('/api/analytics/consolidated', 'kpi_cache');
}
