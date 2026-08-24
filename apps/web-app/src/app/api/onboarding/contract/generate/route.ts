import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const baseUrl = getApiBaseUrlForRoutes();
  const authHeaders = await getProxyAuthHeaders(request);

  const response = await fetch(`${baseUrl}/onboarding/contract/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
