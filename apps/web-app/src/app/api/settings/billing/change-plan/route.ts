/**
 * ============================================================================
 * API PROXY - BILLING CHANGE PLAN
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetchSettingsBackend(request, 'settings/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error changing plan:', error);
    return NextResponse.json({ error: 'Failed to change plan' }, { status: 500 });
  }
}
