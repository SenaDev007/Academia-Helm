/**
 * ============================================================================
 * API ROUTE — Admission Documents Upload (proxy, pattern data URL)
 * ============================================================================
 *
 * Reçoit un JSON body { documentType, fileName, fileDataUrl, mimeType, fileSize }
 * depuis le frontend (pattern aligné sur le module RH — plus de FormData),
 * forward au backend NestJS POST /students/admissions/:id/upload-document.
 *
 * Le backend valide le data URL via IMAGE_OR_PDF_DATA_URL_PIPE (images + PDF,
 * max 20 Mo) et stocke le data URL directement dans AdmissionDocument.filePath.
 *
 * POST /api/students/admissions/[admissionId]/documents
 * Body: JSON {
 *   documentType: string,
 *   fileName: string,
 *   fileDataUrl: string,  // data:image/...;base64,... ou data:application/pdf;base64,...
 *   mimeType: string,
 *   fileSize: number,
 *   comment?: string,
 *   expiresAt?: string,
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for large file uploads

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ admissionId: string }> }
) {
  const { admissionId } = await params;

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Body JSON requis' },
        { status: 400 }
      );
    }
    const { documentType, fileName, fileDataUrl, mimeType, fileSize, comment, expiresAt } = body as {
      documentType?: string;
      fileName?: string;
      fileDataUrl?: string;
      mimeType?: string;
      fileSize?: number;
      comment?: string;
      expiresAt?: string;
    };

    if (!documentType || !fileName || !fileDataUrl) {
      return NextResponse.json(
        { error: 'documentType, fileName et fileDataUrl sont requis' },
        { status: 400 }
      );
    }

    // Forward au backend NestJS — endpoint upload-document (pattern RH)
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/students/admissions/${admissionId}/upload-document`),
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          fileName,
          fileDataUrl,
          mimeType: mimeType || 'application/octet-stream',
          fileSize: fileSize || 0,
          comment,
          expiresAt,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || data.message || 'Failed to create document' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Admission document upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
