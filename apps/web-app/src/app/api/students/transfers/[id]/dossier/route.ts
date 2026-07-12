import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/** GET /api/students/transfers/:id/dossier?level=FULL|MASKED — dossier complet transfert */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const url = new URL(`${API_URL}/students/transfers/${params.id}/dossier`);
    request.nextUrl.searchParams.forEach((value, key) => url.searchParams.append(key, value));
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(url.toString()), { headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching transfer dossier:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
