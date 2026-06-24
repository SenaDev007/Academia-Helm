/**
 * ============================================================================
 * API ROUTE - TEACHERS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/teachers`);
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url.toString(), { headers, cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(`${API_URL}/teachers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to create teacher' }, { status: response.status });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    console.error('Error creating teacher:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

