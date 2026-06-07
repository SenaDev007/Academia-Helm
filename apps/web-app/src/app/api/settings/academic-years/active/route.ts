/**
 * API PROXY - ANNÉE SCOLAIRE ACTIVE
 * Envoie le tenant de la session au backend (x-tenant-id) pour que le contexte soit disponible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getServerToken, getServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

async function getAuthHeaders(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cookieToken = request.cookies.get('academia_token')?.value;
  const sessionToken = await getServerToken();
  const token = authHeader || (cookieToken ? `Bearer ${cookieToken}` : '') || (sessionToken ? `Bearer ${sessionToken}` : '');
  const headers: Record<string, string> = {
    'Authorization': token || '',
    'Content-Type': 'application/json',
  };
  const session = await getServerSession();
  const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
  const tenantId = session?.tenant?.id ?? request.headers.get('x-tenant-id') ?? fromQuery;
  if (tenantId && typeof tenantId === 'string') headers['x-tenant-id'] = tenantId;
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    const response = await fetch(`${API_BASE_URL}/settings/academic-years/active`, {
      headers,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    console.error('Error fetching active academic year:', error);
    return NextResponse.json({ error: 'Failed to fetch active academic year' }, { status: 500 });
  }
}
