/**
 * ============================================================================
 * API PROXY - COLLECTION STATISTICS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/finance/collection/statistics${queryString ? `?${queryString}` : ''}`;

    const headers: HeadersInit = {};
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers['Authorization'] = auth;
    if (cookie) headers['cookie'] = cookie;

    const response = await fetch(url, { headers });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching collection statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch collection statistics' }, { status: 500 });
  }
}

