/**
 * API proxy — Régénération token QR (rôle directeur, anti-abus 5 min)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;
    const body = await request.json();

    if (!body.academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId is required' },
        { status: 400 }
      );
    }

    const url = `${API_BASE_URL}/api/students/${studentId}/verification-token/regenerate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ academicYearId: body.academicYearId }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return NextResponse.json(err, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error regenerating verification token:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate verification token' },
      { status: 500 }
    );
  }
}
