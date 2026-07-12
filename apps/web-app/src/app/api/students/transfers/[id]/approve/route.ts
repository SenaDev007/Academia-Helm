import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/** POST /api/students/transfers/:id/approve — approuver un transfert entrant */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/students/transfers/${params.id}/approve`), {
      method: 'POST',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error approving transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
