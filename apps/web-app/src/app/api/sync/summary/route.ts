/**
 * Sync Summary API Route
 * 
 * Récupère le résumé de synchronisation pour affichage dans l'UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { SyncSummary } from '@/types';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/sync/summary
 * 
 * Récupère le résumé de synchronisation
 */
export async function GET(request: NextRequest) {
  try {
    // Déléguer au backend
    const response = await fetch(`${API_URL}/sync/summary`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la récupération' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération du résumé' },
        { status: response.status }
      );
    }

    const result: SyncSummary = await response.json();

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Sync summary error:', error);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}

