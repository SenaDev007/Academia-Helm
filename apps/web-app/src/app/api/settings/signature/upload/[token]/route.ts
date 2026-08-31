/**
 * Proxy API — Upload signature via magic-link token (PUBLIC, no auth)
 * POST /api/settings/signature/upload/:token
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const url = new URL(`${API_BASE_URL}/settings/signature/upload/${params.token}`);
    const body = await request.json();
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error uploading signature:', error);
    return NextResponse.json({ error: 'Failed to upload signature' }, { status: 500 });
  }
}
