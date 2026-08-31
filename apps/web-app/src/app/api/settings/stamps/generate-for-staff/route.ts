/**
 * Proxy API — Generate BOTH nominative stamps (circular + rectangular)
 * for a specific staff member.
 *
 * POST /api/settings/stamps/generate-for-staff
 *
 * Body: { holderName, holderRole, educationLevelId? }
 *
 * ⭐ The circular stamp has the holder's ROLE at the center (instead of
 *    the school logo). The rectangular stamp has the holder's NAME
 *    (large) + ROLE (smaller) below.
 *
 * Returns: { circularStampUrl, rectangularStampUrl, generatedAt }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/stamps/generate-for-staff`);
    const tenantId = request.nextUrl?.searchParams?.get('tenant_id');
    if (tenantId) url.searchParams.set('tenant_id', tenantId);
    const body = await request.json().catch(() => ({}));
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error generating stamps for staff:', error);
    return NextResponse.json({ error: 'Failed to generate stamps for staff' }, { status: 500 });
  }
}
