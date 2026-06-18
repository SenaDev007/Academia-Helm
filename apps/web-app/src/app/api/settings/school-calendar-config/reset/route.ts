/**
 * ============================================================================
 * API PROXY - SETTINGS SCHOOL CALENDAR CONFIG RESET
 * ============================================================================
 * Proxy for resetting the school calendar configuration to defaults.
 * Forwards to backend: POST /api/settings/school-calendar-config/reset
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function POST(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(
      request,
      'settings/school-calendar-config/reset',
      {
        method: 'POST',
      },
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error resetting school calendar config:', error);
    return NextResponse.json(
      { error: 'Failed to reset school calendar config' },
      { status: 500 },
    );
  }
}
