/**
 * ============================================================================
 * API PROXY - BILLING PLANS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSettingsBackend } from '@/lib/api/settings-proxy-fetch';

export async function GET(request: NextRequest) {
  try {
    const response = await fetchSettingsBackend(request, 'settings/billing/plans');
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching billing plans:', error);
    return NextResponse.json({ error: 'Failed to fetch billing plans' }, { status: 500 });
  }
}
