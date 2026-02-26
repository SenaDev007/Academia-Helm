/**
 * API PROXY - SETTINGS PERMISSIONS GROUPED (même pattern que rbac/ensure-initialized)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/permissions/grouped`);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching grouped permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch grouped permissions' }, { status: 500 });
  }
}
