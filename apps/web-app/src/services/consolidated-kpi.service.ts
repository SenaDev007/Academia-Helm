/**
 * Consolidated KPI Service
 * 
 * Service pour récupérer les bilans consolidés multi-écoles
 * Uniquement pour les SUPER_DIRECTOR (promoteurs)
 */

import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { ConsolidatedKpiResponse } from '@/types';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Récupère les bilans consolidés pour tous les établissements du groupe
 * 
 * @param period - Période de référence (ex: "2024-2025", "2025-01")
 */
export async function getConsolidatedKpi(period?: string): Promise<ConsolidatedKpiResponse> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : '';
  return offlineFetch<ConsolidatedKpiResponse>(`/analytics/consolidated${qs}`, 'kpi_cache', {
    tenantId: getTenantId(),
  });
}
