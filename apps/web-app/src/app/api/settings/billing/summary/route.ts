/**
 * ============================================================================
 * API PROXY - BILLING SUMMARY
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function GET(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/billing/summary');
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching billing summary:', error);
    return NextResponse.json({ error: 'Failed to fetch billing summary' }, { status: 500 });
  }
}
