/**
 * ORION HR KPI API Route
 * 
 * Récupère les KPI RH depuis kpi_hr_monthly
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { KpiHrMonthly } from '@/types';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/orion/kpi/hr
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID') || '';
    const period = request.nextUrl.searchParams.get('period') || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ tenantId });
    if (period) params.append('period', period);

    const response = await fetch(`${API_URL}/orion/kpi/hr?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(null, { status: 404 });
      }
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la récupération' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération des KPI RH' },
        { status: response.status }
      );
    }

    const data: KpiHrMonthly = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('ORION HR KPI error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne' },
      { status: 500 }
    );
  }
}

