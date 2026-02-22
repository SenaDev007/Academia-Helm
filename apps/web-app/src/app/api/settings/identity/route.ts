/**
 * ============================================================================
 * API PROXY - IDENTITÉ ÉTABLISSEMENT
 * ============================================================================
 * Source légale de vérité versionnée. Même logique que périodes/années : auth + tenant.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getServerToken, getServerSession } from '@/lib/auth/session';

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
  const fromSession = session?.tenant?.id;
  const fromHeader = request.headers.get('x-tenant-id');
  const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
  const tenantId = fromSession ?? fromHeader ?? fromQuery;
  if (tenantId && typeof tenantId === 'string') headers['x-tenant-id'] = tenantId;
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    const baseUrl = normalizeApiUrl(getApiBaseUrlForRoutes());
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/settings/identity`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text || text.trim() === '') {
      return NextResponse.json(null, { status: response.status });
    }
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: text || 'Invalid response' }, { status: response.status });
    }
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching identity profile:', error);
    return NextResponse.json({ error: 'Failed to fetch identity profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json(
        { error: 'Session expirée ou non authentifié.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const baseUrl = normalizeApiUrl(getApiBaseUrlForRoutes());
    const url = new URL(`${baseUrl.replace(/\/$/, '')}/settings/identity`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text || text.trim() === '') {
      return NextResponse.json({ success: true }, { status: response.status });
    }
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: text || 'Invalid response' }, { status: response.status });
    }
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating identity version:', error);
    return NextResponse.json({ error: 'Failed to create identity version' }, { status: 500 });
  }
}
