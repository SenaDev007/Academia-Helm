/**
 * Proxy optimisation image → Nest POST /api/media/optimize (Sharp).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    if (!headers['Authorization'] && !headers['Cookie']) {
      return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const url = normalizeApiUrl(`${API_BASE_URL}/media/optimize`);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    console.error('[api/media/optimize]', e);
    return NextResponse.json({ message: 'Service indisponible' }, { status: 502 });
  }
}
