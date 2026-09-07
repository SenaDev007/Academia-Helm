import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const baseUrl = getApiBaseUrlForRoutes();
  const authHeaders = getClientAuthorizationHeader();

  if (body.action === 'settle' && body.eligibilityId) {
    const response = await fetchWithTimeout(
      `${baseUrl}/finance/promoter-eligibility/${body.eligibilityId}/settle`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
      },
    30000);
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
