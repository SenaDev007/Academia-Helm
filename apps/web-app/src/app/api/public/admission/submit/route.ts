/**
 * ============================================================================
 * API ROUTE — Public Admission Submission (proxy BFF)
 * ============================================================================
 *
 * Forward au backend NestJS POST /students/admissions-public/upload-apply
 *
 * Le body JSON contient :
 *   - Les champs de l'élève + responsable légal
 *   - Les documents en data URL base64 (birthCertificate, idPhoto, etc.)
 *
 * Contrairement à l'ancienne route /api/public/pre-enrollment qui avalait
 * les erreurs silencieusement (PENDING_BACKEND_SYNC), cette route propage
 * les erreurs du backend pour que le frontend puisse les afficher.
 *
 * POST /api/public/admission/submit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large file uploads

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Body JSON requis' },
        { status: 400 },
      );
    }

    if (!body.tenantId) {
      return NextResponse.json(
        { error: 'tenantId est requis (sélectionnez une école)' },
        { status: 400 },
      );
    }

    if (!body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: 'Prénom et nom de l\'élève sont requis' },
        { status: 400 },
      );
    }

    // Forward au backend NestJS — endpoint public upload-apply
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/students/admissions-public/upload-apply`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Propager l'erreur du backend (ConflictException, BadRequestException, etc.)
      const errorMsg =
        data.error ||
        data.message ||
        (typeof data.message === 'string' ? data.message : null) ||
        `Échec de la soumission (${response.status})`;
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Public admission submit error:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur lors de la soumission' },
      { status: 500 },
    );
  }
}
