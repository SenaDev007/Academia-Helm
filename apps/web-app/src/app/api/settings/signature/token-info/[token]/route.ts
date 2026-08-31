/**
 * Proxy API — Get signature token info (PUBLIC, no auth)
 * GET /api/settings/signature/token-info/:token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const url = new URL(`${API_BASE_URL}/settings/signature/token-info/${params.token}`);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json({ error: 'Failed to fetch token info' }, { status: 500 });
  }
}
