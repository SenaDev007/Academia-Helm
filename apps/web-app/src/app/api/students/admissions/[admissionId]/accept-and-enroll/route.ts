/**
 * ============================================================================
 * API ROUTE — Admission Accept-and-Enroll (proxy BFF)
 * ============================================================================
 *
 * Route BFF qui forward vers le backend NestJS
 *   POST /students/admissions/:id/accept-and-enroll
 *
 * Cette route effectue DEUX opérations côté backend :
 *   1. Accepte la candidature (passe à ACCEPTED)
 *   2. Convertit en élève inscrit (crée Student + matricule + compte
 *      financier + responsable légal)
 *
 * Body JSON: { comment?: string }
 *
 * Réponse backend : l'objet Student créé (avec matricule, classe, etc.)
 * ============================================================================

 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // L'inscription peut prendre du temps (matricule + compte + guardian)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ admissionId: string }> }
) {
  const { admissionId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const comment = (body as any)?.comment ?? 'Acceptation directe';

    // Forward au backend NestJS
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/admissions/${admissionId}/accept-and-enroll`),
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      }
    , 30000);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          error: (data as any)?.error || (data as any)?.message || 'Échec de l\'acceptation et inscription',
          details: (data as any)?.details || undefined,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Accept-and-enroll error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
