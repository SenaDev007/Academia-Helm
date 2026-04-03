/**
 * ============================================================================
 * API PROXY - PEDAGOGY ORION ALERTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestDoublePrefixedControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${nestDoublePrefixedControllerUrl('pedagogy/orion/alerts')}${queryString ? `?${queryString}` : ''}`;

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url, { headers, cache: 'no-store' });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching pedagogy ORION alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

