/**
 * API proxy — QR vérification publique (dossier / carte scolaire)
 * GET ?academicYearId=... → backend retourne { publicUrl, qrImage, isActive }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get('academicYearId');

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId is required' },
        { status: 400 }
      );
    }

    const url = `${API_BASE_URL}/api/students/${studentId}/verification-qr?academicYearId=${encodeURIComponent(academicYearId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: request.headers.get('Authorization') || '',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(err, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching verification QR:', error);
    return NextResponse.json(
      { error: 'Failed to fetch verification QR' },
      { status: 500 }
    );
  }
}
