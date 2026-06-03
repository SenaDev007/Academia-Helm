/**
 * ============================================================================
 * API PROXY - EDUCAST STATS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/modules-complementaires/educast/stats${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'X-Tenant-ID': request.headers.get('X-Tenant-ID') || '',
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching educast stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

