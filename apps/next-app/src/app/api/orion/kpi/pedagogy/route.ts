/**
 * ORION Pedagogy KPI API Route
 * 
 * Récupère les KPI pédagogiques depuis kpi_pedagogy_term
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { KpiPedagogyTerm } from '@/types';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/orion/kpi/pedagogy
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('X-Tenant-ID') || '';
    const term = request.nextUrl.searchParams.get('term') || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({ tenantId });
    if (term) params.append('term', term);

    const response = await fetch(`${API_URL}/orion/kpi/pedagogy?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la récupération' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération des KPI pédagogiques' },
        { status: response.status }
      );
    }

    const data: KpiPedagogyTerm[] = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('ORION pedagogy KPI error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne' },
      { status: 500 }
    );
  }
}

