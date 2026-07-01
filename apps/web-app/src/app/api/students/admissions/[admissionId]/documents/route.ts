/**
 * ============================================================================
 * API ROUTE — Admission Documents Upload (proxy)
 * ============================================================================
 *
 * Reçoit un FormData (fichier + métadonnées) depuis le frontend,
 * upload le fichier vers Vercel Blob (ou storage local), puis crée
 * l'enregistrement AdmissionDocument via l'API NestJS.
 *
 * Le backend NestJS ne gère pas le multipart directement — ce proxy
 * fait la conversion FormData → JSON + upload fichier.
 *
 * POST /api/students/admissions/[admissionId]/documents
 * Body: FormData {
 *   file: File,
 *   documentType: string,
 *   fileName: string,
 *   mimeType: string,
 *   fileSize: string,
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for file upload

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ admissionId: string }> }
) {
  const { admissionId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string;
    const fileName = formData.get('fileName') as string;
    const mimeType = formData.get('mimeType') as string;
    const fileSize = formData.get('fileSize') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    // 1. Upload du fichier vers Vercel Blob (si configuré) ou stockage local
    let filePath: string | null = null;

    // Vercel Blob upload
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { put } = await import('@vercel/blob');
        const blob = await put(
          `admission-docs/${admissionId}/${Date.now()}-${fileName}`,
          file,
          {
            access: 'public',
            contentType: mimeType || 'application/octet-stream',
            token: process.env.BLOB_READ_WRITE_TOKEN,
          }
        );
        filePath = blob.url;
      } catch (uploadErr: any) {
        console.error('Vercel Blob upload failed:', uploadErr);
        // Continue sans filePath — le document sera créé sans fichier attaché
      }
    }

    // 2. Créer l'enregistrement AdmissionDocument via l'API NestJS
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/students/admissions/${admissionId}/documents`),
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType,
          fileName,
          filePath,
          mimeType,
          fileSize: parseInt(fileSize, 10) || undefined,
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
