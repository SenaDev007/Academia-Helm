/**
 * ============================================================================
 * API PROXY - SETTINGS HISTORY
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function GET(request: NextRequest) {
  try {
    const qs = request.nextUrl.searchParams.toString();
    const path = `settings/history${qs ? `?${qs}` : ''}`;
    const response = await fetchSettingsBackend(request, path);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching settings history:', error);
    return NextResponse.json({ error: 'Failed to fetch settings history' }, { status: 500 });
  }
}
