/**
 * Proxy API — Reset (nullify) the signature for a given role + level.
 * POST /api/settings/signature/reset
 *
 * Body: { role, educationLevelId? }
 *
 * ⭐ Called by the "Réinitialiser" button in RH > Administration when a
 *    signature already exists for a staff (role + level). After reset,
 *    the "Lien signature" button reappears and the staff can re-sign.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/signature/reset`);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    if (tenantId) url.searchParams.set('tenant_id', tenantId);
    const body = await request.json().catch(() => ({}));
    const response = await fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error resetting signature:', error);
    return NextResponse.json({ error: 'Failed to reset signature' }, { status: 500 });
  }
}
