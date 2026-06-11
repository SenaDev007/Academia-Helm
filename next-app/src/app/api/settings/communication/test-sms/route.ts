/**
 * ============================================================================
 * API PROXY - TEST SMS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function POST(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/communication/test-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error testing SMS:', error);
    return NextResponse.json({ error: 'Failed to test SMS' }, { status: 500 });
  }
}
