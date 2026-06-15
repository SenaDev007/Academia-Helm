/**
 * ============================================================================
 * API PROXY - SETTINGS OFFLINE SYNC
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function GET(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/offline-sync');
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching offline sync settings:', error);
    return NextResponse.json({ error: 'Failed to fetch offline sync settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetchSettingsBackend(request, 'settings/offline-sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating offline sync settings:', error);
    return NextResponse.json({ error: 'Failed to update offline sync settings' }, { status: 500 });
  }
}
