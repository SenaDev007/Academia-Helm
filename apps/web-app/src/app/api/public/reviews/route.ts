import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  const API_BASE_URL = getApiBaseUrlForRoutes();
  const path = API_BASE_URL.endsWith('/api')
    ? `${API_BASE_URL}/reviews`
    : `${API_BASE_URL}/api/reviews`;
  const apiUrl = normalizeApiUrl(path);

  try {
    const body = await request.text();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type':
          request.headers.get('Content-Type') || 'application/json',
      },
      body,
    });
    const resBody = await response.text();
    return new NextResponse(resBody, {
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
