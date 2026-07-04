/**
 * ============================================================================
 * API ROUTE — Admission Document Download (proxy)
 * ============================================================================
 *
 * Forward au backend NestJS GET /students/admissions/:id/documents/:docId/download
 * Le backend renvoie le fichier binaire (PDF, image, etc.) avec
 * Content-Disposition: inline pour permettre la prévisualisation navigateur.
 *
 * Cette route proxy transmet les cookies d'auth et forward la réponse binaire
 * telle quelle (y compris les headers Content-Type et Content-Disposition).
 *
 * GET /api/students/admissions/[admissionId]/documents/[docId]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

function isBinaryContentType(contentType: string): boolean {
  return (
    contentType.includes('application/pdf') ||
    contentType.includes('application/octet-stream') ||
    contentType.includes('application/zip') ||
    contentType.includes('image/') ||
    contentType.includes('application/vnd.openxmlformats')
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ admissionId: string; docId: string }> }
) {
  const { admissionId, docId } = await params;

  try {
    const headers = await getProxyAuthHeaders(request);
    // On ne veut pas forcer Accept: application/json pour une réponse binaire
    delete (headers as any)['Accept'];

    const response = await fetch(
      normalizeApiUrl(
        `${API_URL}/students/admissions/${admissionId}/documents/${docId}/download`
      ),
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let errorMsg = 'Failed to download document';
      try {
        const parsed = JSON.parse(text);
        errorMsg = parsed.error || parsed.message || errorMsg;
      } catch {
        if (text) errorMsg = text;
      }
      return NextResponse.json(
        { error: errorMsg },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    if (isBinaryContentType(contentType)) {
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': contentDisposition,
          'Content-Length': String(buffer.length),
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
        },
      });
    }

    // Fallback : renvoyer en JSON si le backend n'a pas renvoyé de binaire
    const text = await response.text().catch(() => '');
    return NextResponse.json(
      { error: 'Réponse inattendue du backend', raw: text.slice(0, 500) },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Admission document download error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
