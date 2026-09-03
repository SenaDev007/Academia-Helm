/**
 * POST /api/auth/2fa/enable — active la 2FA après vérification du code TOTP.
 * Renvoie les 10 codes de secours UNE SEULE FOIS. ⭐ V5.
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
    ? `${API_BASE_URL}/auth/2fa/enable`
    : `${API_BASE_URL}/api/auth/2fa/enable`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { ...bffHeaders(), ...authHeaders },
    body: JSON.stringify({ code: body?.code || '' }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }
  return NextResponse.json(data);
}
