import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/** POST /api/students/transfers/:id/execute — exécuter le transfert */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/students/transfers/${params.id}/execute`), {
      method: 'POST',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error executing transfer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
