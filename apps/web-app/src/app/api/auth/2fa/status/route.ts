/**
 * GET /api/auth/2fa/status — statut 2FA de l'utilisateur courant. ⭐ V5.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeaders = await getProxyAuthHeaders(request);
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const apiUrl = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/auth/2fa/status`
    : `${API_BASE_URL}/api/auth/2fa/status`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: { ...bffHeaders(), ...authHeaders },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }
  return NextResponse.json(data);
}
