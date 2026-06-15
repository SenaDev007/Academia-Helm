/**
 * ============================================================================
 * API PROXY - TEST EMAIL
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const response = await fetchSettingsBackend(request, 'settings/communication/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(raw ? { body: raw } : {}),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error testing email:', error);
    return NextResponse.json({ error: 'Failed to test email' }, { status: 500 });
  }
}
