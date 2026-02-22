/**
 * API PROXY - Clôturer une année scolaire
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
  const headers: Record<string, string> = { Authorization: token || '', 'Content-Type': 'application/json' };
  const session = await getServerSession();
  const fromSession = session?.tenant?.id;
  const fromHeader = request.headers.get('x-tenant-id');
  const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
  const tenantId = fromSession || fromHeader || fromQuery;
  if (tenantId && typeof tenantId === 'string') headers['x-tenant-id'] = tenantId;
  return headers;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    const response = await fetch(`${API_BASE_URL}/settings/academic-years/${id}/close`, {
      method: 'POST',
      headers,
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: await response.text() || 'Erreur serveur' };
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error closing academic year:', error);
    return NextResponse.json({ error: 'Failed to close academic year' }, { status: 500 });
  }
}
