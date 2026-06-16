import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const search = request.nextUrl.search;
  const path = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/reviews/published${search}`
    : `${API_BASE_URL}/reviews/published${search}`;
  const apiUrl = normalizeApiUrl(path);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: bffHeaders(),
      // Revalidation courte (5 s) : les nouveaux avis déposés depuis l'app
      // tenant (auto-approuvés) doivent apparaître quasi-immédiatement sur le
      // landing page public sans attendre 60 s.
      next: { revalidate: 5 },
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Service indisponible' },
      { status: 502 },
    );
  }
}
