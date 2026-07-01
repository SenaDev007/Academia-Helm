/**
 * ============================================================================
 * API ROUTE — Public School Info (proxy BFF)
 * ============================================================================
 *
 * Forward au backend NestJS GET /students/admissions-public/school-info/:tenantIdentifier
 *
 * Retourne les niveaux scolaires (school_levels) + classes configurés par
 * l'établissement, pour que le portail public d'admission construise
 * dynamiquement le formulaire (cartes de niveaux + select classes).
 *
 * GET /api/public/school-info/:tenantIdentifier
 *   → tenantIdentifier = UUID | slug | subdomain
 *   → Response: { schoolLevels: [{id, name, code}], classes: [{id, name, code, schoolLevelId}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantIdentifier: string }> },
) {
  try {
    const { tenantIdentifier } = await params;
    if (!tenantIdentifier) {
      return NextResponse.json(
        { error: 'tenantIdentifier est requis' },
        { status: 400 },
      );
    }

    const url = normalizeApiUrl(
      `${API_URL}/students/admissions-public/school-info/${encodeURIComponent(tenantIdentifier)}`,
    );
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching school-info:', error);
    return NextResponse.json(
      { error: 'Internal server error', schoolLevels: [], classes: [] },
      { status: 500 },
    );
  }
}
