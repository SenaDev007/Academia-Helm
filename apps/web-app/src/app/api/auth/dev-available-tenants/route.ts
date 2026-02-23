/**
 * Proxy vers GET /auth/dev-available-tenants (liste des écoles en mode dev, sans auth)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Dev available tenants is only available in development mode' },
        { status: 403 }
      );
    }
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/dev-available-tenants`
      : `${apiBaseUrl}/api/auth/dev-available-tenants`;
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Dev Available Tenants API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dev available tenants' },
      { status: 500 }
    );
  }
}
