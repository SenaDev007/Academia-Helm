/**
 * ============================================================================
 * API PROXY - IA STATUS
 * ============================================================================
 * Proxies requests to the NestJS backend to check the AI configuration
 * status of the HDIE engine.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const url = `${API_BASE_URL}/hr/ia/status`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching IA status:', error);
    return NextResponse.json({ error: 'Failed to fetch IA status' }, { status: 500 });
  }
}
