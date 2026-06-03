/**
 * ============================================================================
 * API PROXY - GET CNSS RATE
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryCode: string }> }
) {
  const { countryCode } = await params;
  try {
    const response = await fetch(`${API_BASE_URL}/api/hr/cnss/rates/active?countryCode=${encodeURIComponent(countryCode)}`, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching active CNSS rate:', error);
    return NextResponse.json({ error: 'Failed to fetch active CNSS rate' }, { status: 500 });
  }
}

