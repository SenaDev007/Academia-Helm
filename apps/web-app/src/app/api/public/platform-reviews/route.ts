import { NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET() {
  try {
    const apiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/public/platform-reviews`
      : `${API_BASE_URL}/api/public/platform-reviews`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      return NextResponse.json({ reviews: [] }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json(Array.isArray(data?.reviews) ? data : { reviews: [] });
  } catch {
    return NextResponse.json({ reviews: [] }, { status: 200 });
  }
}
