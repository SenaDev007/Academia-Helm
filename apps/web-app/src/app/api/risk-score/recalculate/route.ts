/**
 * ============================================================================
 * BFF ROUTE — Risk Score Recalculate (proxy vers NestJS)
 * ============================================================================
 *
 * POST /api/risk-score/recalculate  — Recalcule les scores pour tout le tenant
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const backendUrl = new URL(`${API_URL}/risk-score/recalculate`);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    const headers = await getProxyAuthHeaders(request);
    headers['Content-Type'] = 'application/json';

    const response = await fetchWithTimeout(
      normalizeApiUrl(backendUrl.toString()),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      120000, // 2 min — opération lourde
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend error', detail: data },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF risk-score/recalculate] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to recalculate risk scores', detail: error.message },
      { status: 500 },
    );
  }
}
