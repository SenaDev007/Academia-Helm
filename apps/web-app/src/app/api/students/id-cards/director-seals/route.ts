/**
 * ============================================================================
 * API ROUTE - ID CARD DIRECTOR SEALS (Carte scolaire)
 * GET /api/students/id-cards/director-seals?schoolLevelId=...
 * Signature + cachet + nom du directeur (résolution par niveau scolaire :
 * directeur du secondaire ≠ directeur maternel/primaire) pour l'aperçu.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const url = new URL(`${API_URL}/students/id-cards/director-seals`);
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key === 'tenant_id') {
        url.searchParams.append('tenantId', value);
      } else {
        url.searchParams.append(key, value);
      }
    });
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), { headers, cache: 'no-store' }, 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error fetching director seals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
