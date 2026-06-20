/**
 * API PROXY - Contract Public Sign (GET infos)
 *
 * GET /api/contracts-public/[token] → infos contrat (validation token)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const url = `${API_BASE_URL}/hr/contracts-public/${token}`;

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching contract info by token:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contract info' },
      { status: 500 },
    );
  }
}
