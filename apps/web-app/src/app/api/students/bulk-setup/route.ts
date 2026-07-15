import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const body = await request.json();
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = `${apiBaseUrl}/students/bulk-setup`;

    const response = await fetch(normalizeApiUrl(url), {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF bulk-setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to bulk setup', message: error.message },
      { status: 500 },
    );
  }
}
