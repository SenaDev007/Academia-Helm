/**
 * Proxy Next.js pour GET /onboarding/subdomain/suggest?schoolName=xxx
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    const schoolName = request.nextUrl.searchParams.get('schoolName') ?? '';
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const url = `${apiBaseUrl}/onboarding/subdomain/suggest?schoolName=${encodeURIComponent(schoolName)}`;
    const response = await fetch(normalizeApiUrl(url), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json(data, { status: response.status });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding subdomain suggest error:', error);
    return NextResponse.json({ error: 'Failed to get subdomain suggestions' }, { status: 500 });
  }
}
