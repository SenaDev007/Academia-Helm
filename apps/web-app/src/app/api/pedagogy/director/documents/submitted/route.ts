/**
 * ============================================================================
 * API PROXY - DIRECTOR SUBMITTED DOCUMENTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/pedagogy/director/documents/submitted${queryString ? `?${queryString}` : ''}`;

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url, { headers, cache: 'no-store' });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching submitted documents:', error);
    return NextResponse.json({ error: 'Failed to fetch submitted documents' }, { status: 500 });
  }
}

