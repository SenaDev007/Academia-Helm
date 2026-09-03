/**
 * POST /api/auth/2fa/disable — désactive la 2FA (code TOTP OU mot de passe). ⭐ V5.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const authHeaders = await getProxyAuthHeaders(request);
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const apiUrl = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/auth/2fa/disable`
    : `${API_BASE_URL}/api/auth/2fa/disable`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { ...bffHeaders(), ...authHeaders },
    body: JSON.stringify({ code: body?.code || undefined, password: body?.password || undefined }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }
  return NextResponse.json(data);
}
