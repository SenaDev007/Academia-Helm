/**
 * ============================================================================
 * BFF ROUTE — WhatsApp Logs Stats (proxy vers NestJS)
 * ============================================================================
 *
 * GET /api/communication/whatsapp-logs-stats
 *   Proxy vers GET /communication/whatsapp-logs-stats du backend.
 *   Retourne les statistiques agrégées des WhatsappLogs.
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

    const backendUrl = new URL(`${API_URL}/communication/whatsapp-logs-stats`);
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
    console.error('[BFF whatsapp-logs-stats] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp logs stats', detail: error.message },
      { status: 500 },
    );
  }
}
