/**
 * ============================================================================
 * API PROXY - PUBLIC RECEIPT VERIFICATION
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const url = `${API_BASE_URL}/receipts/public/verify/${token}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: bffHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error verifying receipt token:', error);
    return NextResponse.json(
      { error: 'Failed to verify receipt token', isValid: false },
      { status: 500 }
    );
  }
}

