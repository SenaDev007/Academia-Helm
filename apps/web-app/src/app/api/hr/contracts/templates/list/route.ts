/**
 * ============================================================================
 * API PROXY - CONTRACT TEMPLATES LIST
 * ============================================================================
 * Proxies requests to the NestJS backend for listing contract templates.
 * This route exists for frontend compatibility alongside the existing
 * /contracts/templates endpoint.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/hr/contracts/templates${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching contract templates list:', error);
    return NextResponse.json({ error: 'Failed to fetch contract templates list' }, { status: 500 });
  }
}
