/**
 * ============================================================================
 * API PROXY - DEFAULT CONTRACT TEMPLATE BY TYPE
 * ============================================================================
 * Proxies requests to the NestJS backend for fetching the default contract
 * template filtered by contract type. The [type] dynamic segment is passed
 * as a query parameter to the backend.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  try {
    const url = `${API_BASE_URL}/api/hr/contracts/templates?type=${encodeURIComponent(type)}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching default contract template:', error);
    return NextResponse.json({ error: 'Failed to fetch default contract template' }, { status: 500 });
  }
}
