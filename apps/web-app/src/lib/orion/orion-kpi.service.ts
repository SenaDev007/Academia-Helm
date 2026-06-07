/**
 * ORION KPI Service
 * 
 * Service pour charger les KPI depuis les tables IA dédiées uniquement
 * 
 * CONTRAINTE ABSOLUE :
 * - Lecture UNIQUEMENT depuis les tables KPI IA (kpi_financial_monthly, kpi_hr_monthly, etc.)
 * - JAMAIS de lecture directe des tables métier
 */

import type {
  KpiFinancialMonthly,
  KpiHrMonthly,
  KpiPedagogyTerm,
  KpiSystemHealth,
  DirectionKpiSummary,
} from '@/types';

import { getApiBaseUrl } from '@/lib/utils/urls';
const API_URL = getApiBaseUrl();

/**
 * Charge les KPI financiers mensuels depuis kpi_financial_monthly
 */
export async function loadFinancialKpi(
  tenantId: string,
  period?: string
): Promise<KpiFinancialMonthly | null> {
  const params = period ? { period } : {};
  
  const response = await fetch(`${API_URL}/orion/kpi/financial?tenantId=${tenantId}${period ? `&period=${period}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to load financial KPI: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Charge les KPI RH mensuels depuis kpi_hr_monthly
 */
export async function loadHrKpi(
  tenantId: string,
  period?: string
): Promise<KpiHrMonthly | null> {
  const response = await fetch(`${API_URL}/orion/kpi/hr?tenantId=${tenantId}${period ? `&period=${period}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to load HR KPI: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Charge les KPI pédagogiques depuis kpi_pedagogy_term
 */
export async function loadPedagogyKpi(
  tenantId: string,
  term?: string
): Promise<KpiPedagogyTerm[]> {
  const response = await fetch(`${API_URL}/orion/kpi/pedagogy?tenantId=${tenantId}${term ? `&term=${term}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load pedagogy KPI: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Charge les KPI santé système depuis kpi_system_health
 */
export async function loadSystemHealthKpi(
  tenantId: string,
  period?: string
): Promise<KpiSystemHealth | null> {
  const response = await fetch(`${API_URL}/orion/kpi/system-health?tenantId=${tenantId}${period ? `&period=${period}` : ''}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to load system health KPI: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Charge tous les KPI pour une période et construit un DirectionKpiSummary
 * (pour compatibilité avec l'existant)
 */
export async function loadDirectionKpi(
  tenantId: string,
  period?: string
): Promise<DirectionKpiSummary> {
  const [financialKpi, hrKpi, systemHealthKpi] = await Promise.all([
    loadFinancialKpi(tenantId, period),
    loadHrKpi(tenantId, period),
    loadSystemHealthKpi(tenantId, period),
  ]);

  // Construire un DirectionKpiSummary à partir des tables KPI
  const periodLabel = period || new Date().toISOString().substring(0, 7);
  
  return {
    totalStudents: 0, // TODO: Depuis kpi_pedagogy_term ou autre source KPI
    totalTeachers: hrKpi?.teachersTotal || 0,
    periodLabel,
    totalRevenue: financialKpi?.revenueCollected || 0,
    currency: 'XOF',
    recoveryRate: financialKpi?.collectionRate || 0,
    teacherPresenceRate: hrKpi ? 100 - hrKpi.absenceRate : 100,
    examsActivityIndex: 0, // TODO: Depuis kpi_pedagogy_term
  };
}

/**
 * Charge les KPI pour une période précédente (pour comparaison)
 */
export async function loadPreviousPeriodKpi(
  tenantId: string,
  currentPeriod: string
): Promise<DirectionKpiSummary | null> {
  // Calculer la période précédente
  const [year, month] = currentPeriod.split('-').map(Number);
  const previousDate = new Date(year, month - 2, 1); // Mois précédent
  const previousPeriod = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, '0')}`;

  try {
    return await loadDirectionKpi(tenantId, previousPeriod);
  } catch {
    return null; // Période précédente non disponible
  }
}

