/**
 * API PROXY - Périodes académiques d'une année (liste + création)
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/academic-years/${id}/periods`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { headers, cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    console.error('Error fetching academic year periods:', error);
    return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json(
        { error: 'Session expirée ou non authentifié.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/academic-years/${id}/periods`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating academic period:', error);
    return NextResponse.json({ error: 'Failed to create period' }, { status: 500 });
  }
}
