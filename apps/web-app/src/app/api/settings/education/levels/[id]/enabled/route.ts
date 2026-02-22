/**
 * API PROXY - Activer/desactiver un niveau (MATERNELLE, PRIMAIRE, SECONDAIRE)
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
  const tenantId = session?.tenant?.id ?? request.headers.get('x-tenant-id') ?? request.nextUrl?.searchParams?.get('tenant_id');
  if (tenantId && typeof tenantId === 'string') headers['x-tenant-id'] = tenantId;
  return headers;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json({ error: 'Non authentifie', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/education/levels/${id}/enabled`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { method: 'PUT', headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error updating level enabled:', error);
    return NextResponse.json({ error: 'Failed to update level' }, { status: 500 });
  }
}
