/**
 * Proxy API — Get signature token info (PUBLIC, no auth)
 * GET /api/settings/signature/token-info/:token
 *
 * ⭐ Next.js 16: `params` is now a Promise and must be awaited. Treating it
 *    as a sync object returns `[object Promise]` for `params.token`, which
 *    causes the backend to receive a bogus token and return 404 — making
 *    every signature magic-link email show "Lien invalide".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const url = new URL(`${API_BASE_URL}/settings/signature/token-info/${token}`);
    const response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json({ error: 'Failed to fetch token info' }, { status: 500 });
  }
}
