/**
 * ============================================================================
 * API PROXY - IA FRAUD DETECTION
 * ============================================================================
 * Proxies requests to the NestJS backend for AI-powered fraud/anomaly
 * detection in candidate applications.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || '';

    const url = `${API_BASE_URL}/api/hr/ia/detect-fraud`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': tenantId,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error detecting fraud:', error);
    return NextResponse.json({ error: 'Failed to detect fraud' }, { status: 500 });
  }
}
