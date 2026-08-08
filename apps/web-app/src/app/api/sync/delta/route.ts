/**
 * BFF Route — GET /api/sync/delta?since=ISO_DATE
 * Proxy vers le backend NestJS /api/sync/delta
 * Utilisé par le service offline-sync pour la sync descendante Neon → local.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.search; // inclut ?since=...&tenantId=...
    const targetUrl = normalizeApiUrl(`${API_URL}/sync/delta${search}`);

    const headers = await getProxyAuthHeaders(request);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[sync/delta] proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 },
    );
  }
}
