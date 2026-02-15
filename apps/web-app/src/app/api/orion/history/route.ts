/**
 * ORION History API Route
 * 
 * Récupère l'historique des analyses ORION
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { OrionAnalysisHistory } from '@/types';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/orion/history
 * 
 * Récupère l'historique des analyses
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Vérifier l'authentification et le rôle
    const tenantId = request.headers.get('X-Tenant-ID') || '';
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const type = request.nextUrl.searchParams.get('type') as 'QUERY' | 'MONTHLY_SUMMARY' | 'ALERT' | null;
    const startDate = request.nextUrl.searchParams.get('startDate') || undefined;
    const endDate = request.nextUrl.searchParams.get('endDate') || undefined;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    // Déléguer au backend
    const params = new URLSearchParams({ limit: limit.toString() });
    if (type) params.append('type', type);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`${API_URL}/orion/history?tenantId=${tenantId}&${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la récupération' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération de l\'historique' },
        { status: response.status }
      );
    }

    const data: OrionAnalysisHistory[] = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('ORION history error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orion/history
 * 
 * Journalise une analyse ORION
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = request.headers.get('X-Tenant-ID') || '';

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID manquant' },
        { status: 400 }
      );
    }

    // Déléguer au backend
    const response = await fetch(`${API_URL}/orion/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...body,
        tenantId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors de l\'enregistrement' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de l\'enregistrement de l\'historique' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('ORION history POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur interne' },
      { status: 500 }
    );
  }
}

