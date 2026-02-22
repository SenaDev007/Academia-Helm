/**
 * API PROXY - Année scolaire par ID (détail, mise à jour, suppression)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getServerToken, getServerSession } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();
const TOKEN_COOKIE = 'academia_token';

/** Extrait le token depuis l'en-tête Cookie (fallback si request.cookies ne le voit pas). */
function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1].trim()) : null;
}

async function getAuthHeaders(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  let rawToken =
    (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim()) ||
    request.cookies.get(TOKEN_COOKIE)?.value?.trim() ||
    getTokenFromCookieHeader(request.headers.get('cookie'));
  if (!rawToken) {
    const serverToken = await getServerToken();
    rawToken = serverToken?.trim() || '';
  }
  const token = rawToken ? (rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`) : '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = token;
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) headers['Cookie'] = cookieHeader;
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
    const response = await fetch(`${API_BASE_URL}/settings/academic-years/${id}`, { headers });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching academic year:', error);
    return NextResponse.json({ error: 'Failed to fetch academic year' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json(
        { error: 'Session expirée ou non authentifié. Veuillez vous reconnecter.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const hasDates = body && (body.preEntryDate != null || body.officialStartDate != null || body.startDate != null || body.endDate != null);
    if (!hasDates && process.env.NODE_ENV === 'development') {
      console.warn('[academic-years PUT] Body sans dates reçu:', Object.keys(body || {}));
    }
    const url = new URL(`${API_BASE_URL}/settings/academic-years/${id}`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating academic year:', error);
    return NextResponse.json({ error: 'Failed to update academic year' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    const response = await fetch(`${API_BASE_URL}/settings/academic-years/${id}`, {
      method: 'DELETE',
      headers,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error deleting academic year:', error);
    return NextResponse.json({ error: 'Failed to delete academic year' }, { status: 500 });
  }
}
