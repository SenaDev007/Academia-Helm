/**
 * ============================================================================
 * API PROXY - IA MATCHING CANDIDATES (XAI)
 * ============================================================================
 * Proxies requests to the NestJS backend for AI-powered candidate matching
 * with Explainable AI scoring breakdown.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId') || '';
    const tenantId = searchParams.get('tenantId') || '';

    const queryParams = new URLSearchParams();
    if (jobId) queryParams.set('jobId', jobId);

    const url = `${API_BASE_URL}/api/hr/ia/match-candidates${queryParams.toString() ? `?${queryParams}` : ''}`;

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
    console.error('Error matching candidates:', error);
    return NextResponse.json({ error: 'Failed to match candidates' }, { status: 500 });
  }
}
