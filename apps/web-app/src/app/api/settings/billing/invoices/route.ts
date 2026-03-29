/**
 * ============================================================================
 * API PROXY - BILLING INVOICES
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');

    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit);

    const qs = params.toString();
    const path = qs ? `settings/billing/invoices?${qs}` : 'settings/billing/invoices';

    const headers = await getProxyAuthHeaders(request);
    const url = normalizeApiUrl(`${API_BASE_URL.replace(/\/$/, '')}/${path}`);
    const response = await fetch(url, { headers, cache: 'no-store' });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
