import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const body = await request.json();
    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'Revocation reason is mandatory' }, { status: 400 });
    }
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(
      normalizeApiUrl(`${API_URL}/api/students/id-cards/${cardId}/revoke`),
      { method: 'PUT', headers, body: JSON.stringify(body) }
    );
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error revoking ID card:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
