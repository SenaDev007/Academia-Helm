/**
 * ============================================================================
 * API ROUTE — PDF liste de classe (proxy BFF)
 * ============================================================================
 *
 * Forward au backend NestJS GET /students/class-list/:classId/pdf
 *
 * Génère le PDF de la liste des élèves d'une classe avec en-tête officiel :
 *   - Maternelle/Primaire → "Ministère des Enseignements Maternel et Primaire"
 *   - Secondaire → "Ministère de l'Enseignement Secondaire..."
 *
 * GET /api/students/class-list/:classId/pdf?academicYearId=xxx
 *   → Response: PDF binaire (application/pdf)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const { classId } = await params;
    const academicYearId = request.nextUrl.searchParams.get('academicYearId');

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId est requis' },
        { status: 400 },
      );
    }

    const url = new URL(`${API_URL}/students/class-list/${encodeURIComponent(classId)}/pdf`);
    url.searchParams.append('academicYearId', academicYearId);

    const headers = await getProxyAuthHeaders(request);

    const response = await fetch(normalizeApiUrl(url.toString()), { headers });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('[BFF class-list PDF] Backend returned', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}`, detail: errorText },
        { status: response.status },
      );
    }

    // Stream le PDF binaire vers le client
    const pdfBuffer = await response.arrayBuffer();
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/pdf');

    // Transmettre le Content-Disposition du backend (nom de fichier)
    const cd = response.headers.get('Content-Disposition');
    if (cd) {
      responseHeaders.set('Content-Disposition', cd);
    } else {
      responseHeaders.set('Content-Disposition', `inline; filename="liste_classe.pdf"`);
    }

    responseHeaders.set('Content-Length', String(pdfBuffer.byteLength));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Error generating class list PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
