/**
 * ============================================================================
 * BFF ROUTE — Risk Score Settings (proxy vers NestJS)
 * ============================================================================
 *
 * GET  /api/risk-score/settings  — Récupère la config
 * PUT  /api/risk-score/settings  — Modifie la config (Directeur only)
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const backendUrl = new URL(`${API_URL}/risk-score/settings`);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(backendUrl.toString()),
      { headers, cache: 'no-store' },
      15000,
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
    console.error('[BFF risk-score/settings GET] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch risk score settings', detail: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const backendUrl = new URL(`${API_URL}/risk-score/settings`);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    const headers = await getProxyAuthHeaders(request);
    headers['Content-Type'] = 'application/json';

    const response = await fetchWithTimeout(
      normalizeApiUrl(backendUrl.toString()),
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      15000,
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
    console.error('[BFF risk-score/settings PUT] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to update risk score settings', detail: error.message },
      { status: 500 },
    );
  }
}
