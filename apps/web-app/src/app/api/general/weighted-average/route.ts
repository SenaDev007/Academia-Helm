/**
 * ============================================================================
 * API ROUTE: WEIGHTED AVERAGE (MOCK)
 * ============================================================================
 * 
 * Route mock pour la moyenne pondérée générale
 * Retourne des données fictives pour permettre au dashboard de s'afficher
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');
    const schoolLevelId = searchParams.get('schoolLevelId');

    // Données mock pour la moyenne pondérée
    const mockData = {
      weightedAverage: 14.5,
      evolution: [
        { period: 'T1', value: 13.2 },
        { period: 'T2', value: 14.0 },
        { period: 'T3', value: 14.5 },
      ],
      bilingualComparison: {
        french: 14.8,
        english: 14.2,
      },
      academicYearId: academicYearId || 'mock-academic-year-current',
      schoolLevelId: schoolLevelId || 'mock-school-level-primary',
    };

    return NextResponse.json(mockData, { status: 200 });
  } catch (error) {
    console.error('Error in weighted-average route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

