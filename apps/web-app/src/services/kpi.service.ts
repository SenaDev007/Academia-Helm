/**
 * KPI Service
 *
 * Service léger pour récupérer les KPI directionnels (Bilans & Indicateurs).
 * Toutes les agrégations et calculs sont effectués côté backend.
 */

import { offlineFetch } from '@/lib/offline/offline-fetch';
import type { DirectionKpiResponse } from '@/types';

function getTenantId(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:(?:^|.*;\s*)x-tenant-id\s*\=\s*([^;]*).*$)|^.*$/);
  return match ? decodeURIComponent(match[1]) : '';
}

/**
 * Récupère les KPI directionnels pour le tenant courant.
 *
 * Route backend attendue : GET /analytics/direction
 */
export async function getDirectionKpi(): Promise<DirectionKpiResponse> {
  return offlineFetch<DirectionKpiResponse>('/analytics/direction', 'kpi_cache', {
    tenantId: getTenantId(),
  });
}
