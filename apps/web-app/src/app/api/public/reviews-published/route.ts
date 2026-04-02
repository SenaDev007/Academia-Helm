import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const search = request.nextUrl.search;
  const path = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/reviews/published${search}`
    : `${API_BASE_URL}/api/reviews/published${search}`;
  const apiUrl = normalizeApiUrl(path);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
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
