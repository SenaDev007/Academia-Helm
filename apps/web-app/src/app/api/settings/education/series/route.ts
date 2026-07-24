/**
 * API PROXY - Séries du 2nd cycle secondaire
 *
 * GET  /api/settings/education/series           → liste les séries
 * POST /api/settings/education/series           → crée une série + 3 grades
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getServerToken, getServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

async function getAuthHeaders(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cookieToken = request.cookies.get('academia_token')?.value;
  const sessionToken = await getServerToken();
  const token = authHeader || (cookieToken ? `Bearer ${cookieToken}` : '') || (sessionToken ? `Bearer ${sessionToken}` : '');
  const headers: Record<string, string> = { Authorization: token || '', 'Content-Type': 'application/json' };
  const session = await getServerSession();
  const tenantId = session?.tenant?.id ?? request.headers.get('x-tenant-id') ?? request.nextUrl?.searchParams?.get('tenant_id');
  if (tenantId && typeof tenantId === 'string') headers['x-tenant-id'] = tenantId;
  return headers;
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/education/series`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { method: 'GET', headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('Error listing education series:', error);
    return NextResponse.json({ error: 'Failed to list series' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/education/series`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('Error creating education series:', error);
    return NextResponse.json({ error: 'Failed to create series' }, { status: 500 });
  }
}
