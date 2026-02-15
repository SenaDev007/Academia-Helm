/**
 * Proxy Next.js pour GET /onboarding/subdomain/check/:subdomain
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    if (!subdomain) {
      return NextResponse.json(
        { error: 'subdomain is required' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const encoded = encodeURIComponent(subdomain);
    const url = `${apiBaseUrl}/onboarding/subdomain/check/${encoded}`;

    const response = await fetch(normalizeApiUrl(url), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding subdomain check error:', error);
    return NextResponse.json(
      { error: 'Failed to check subdomain' },
      { status: 500 }
    );
  }
}
