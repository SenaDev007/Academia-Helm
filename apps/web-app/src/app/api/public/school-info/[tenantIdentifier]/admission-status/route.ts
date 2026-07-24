/**
 * GET /api/public/school-info/:tenantIdentifier/admission-status
 *
 * Proxy public vers le backend NestJS qui retourne l'état d'ouverture
 * des admissions publiques pour l'année active du tenant.
 *
 * Aucune authentification requise (portail public).
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantIdentifier: string }> },
) {
  try {
    const { tenantIdentifier } = await params;
    const url = normalizeApiUrl(
      `${API_URL}/students/admissions-public/school-info/${encodeURIComponent(tenantIdentifier)}/admission-status`,
    );
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json().catch(() => ({
      isOpen: false,
      reason: 'Service indisponible. Veuillez contacter l\'établissement directement.',
    }));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error: any) {
    console.error('[BFF admission-status] Error:', error.message);
    return NextResponse.json(
      {
        isOpen: false,
        reason: 'Service indisponible. Veuillez contacter l\'établissement directement.',
        admissionEnabled: false,
        admissionOpenDate: null,
        admissionCloseDate: null,
        academicYearName: null,
      },
      { status: 200 },
    );
  }
}
