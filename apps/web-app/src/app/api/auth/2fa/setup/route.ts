/**
 * POST /api/auth/2fa/setup — génère le secret PENDING + QR (JWT requis).
 * ⭐ V5 — 2FA TOTP depuis les Paramètres Helm Connect.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeaders = await getProxyAuthHeaders(request);
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const apiUrl = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/auth/2fa/setup`
    : `${API_BASE_URL}/api/auth/2fa/setup`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { ...bffHeaders(), ...authHeaders },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }
  return NextResponse.json(data);
}
