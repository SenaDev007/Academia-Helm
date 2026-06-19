/**
 * API PROXY - Contract Public Sign (POST signature)
 *
 * POST /api/contracts-public/[token]/sign
 * Body: { signatureData: string (base64 PNG), signerName: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const url = `${API_BASE_URL}/hr/contracts-public/${token}/sign`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error signing contract by token:', error);
    return NextResponse.json(
      { error: 'Failed to sign contract' },
      { status: 500 },
    );
  }
}
