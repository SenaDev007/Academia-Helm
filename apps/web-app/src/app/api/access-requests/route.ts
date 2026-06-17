/**
 * GET /api/access-requests — liste les demandes d'accès pour le tenant courant
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, bffHeaders } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeaders = await getProxyAuthHeaders(request);
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const apiUrl = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/access-requests`
    : `${API_BASE_URL}/api/access-requests`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: { ...bffHeaders(), ...authHeaders },
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }
  return NextResponse.json(data);
}
