/**
 * API PROXY - Document Upload Submit (POST)
 *
 * POST /api/documents-public/[token]/submit → finalize the document submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const url = `${API_BASE_URL}/documents-public/${token}/submit`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error submitting documents:', error);
    return NextResponse.json(
      { error: 'Failed to submit documents' },
      { status: 500 },
    );
  }
}
