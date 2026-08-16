/**
 * ============================================================================
 * BFF ROUTE — WhatsApp Logs (proxy vers NestJS)
 * ============================================================================
 *
 * GET /api/communication/whatsapp-logs
 *   Proxy vers GET /communication/whatsapp-logs du backend.
 *   Retourne la liste paginée des WhatsappLogs pour le tenant courant.
 *
 * Query params : tenantId, category, module, status, recipient, templateId,
 *                dateFrom, dateTo, page, pageSize
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

    // Construire l'URL backend avec les mêmes query params
    const backendUrl = new URL(`${API_URL}/communication/whatsapp-logs`);
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.append(key, value);
    });

    // Si pas de tenantId en query, le récupérer depuis les headers/cookies
    if (!backendUrl.searchParams.has('tenantId')) {
      const headers = await getProxyAuthHeaders(request);
      // Le backend résout tenantId depuis le JWT ou le header x-tenant-id
      // (les endpoints sont @Public mais utilisent tenantId query)
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
    }

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
    console.error('[BFF whatsapp-logs] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch WhatsApp logs', detail: error.message },
      { status: 500 },
    );
  }
}
