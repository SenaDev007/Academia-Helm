/**
 * ============================================================================
 * API PROXY - SETTINGS BILLING
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function GET(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/billing');
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching billing settings:', error);
    return NextResponse.json({ error: 'Failed to fetch billing settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetchSettingsBackend(request, 'settings/billing', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating billing settings:', error);
    return NextResponse.json({ error: 'Failed to update billing settings' }, { status: 500 });
  }
}
