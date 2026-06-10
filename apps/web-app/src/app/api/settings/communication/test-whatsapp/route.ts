/**
 * ============================================================================
 * API PROXY - TEST WHATSAPP
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function POST(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/communication/test-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error testing WhatsApp:', error);
    return NextResponse.json({ error: 'Failed to test WhatsApp' }, { status: 500 });
  }
}
