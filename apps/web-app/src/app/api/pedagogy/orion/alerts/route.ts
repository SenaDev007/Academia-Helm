/**
 * ============================================================================
 * API PROXY - PEDAGOGY ORION ALERTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { nestControllerUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${nestControllerUrl('pedagogy/orion/alerts')}${queryString ? `?${queryString}` : ''}`;

    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(url, { headers, cache: 'no-store' });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching pedagogy ORION alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

