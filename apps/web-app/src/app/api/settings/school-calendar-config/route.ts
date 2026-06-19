/**
 * ============================================================================
 * API PROXY - SETTINGS SCHOOL CALENDAR CONFIG
 * ============================================================================
 * Proxy for the school calendar configuration endpoints.
 * Forwards to backend: GET / PUT /api/settings/school-calendar-config
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function GET(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/school-calendar-config');
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching school calendar config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch school calendar config' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetchSettingsBackend(request, 'settings/school-calendar-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating school calendar config:', error);
    return NextResponse.json(
      { error: 'Failed to update school calendar config' },
      { status: 500 },
    );
  }
}
