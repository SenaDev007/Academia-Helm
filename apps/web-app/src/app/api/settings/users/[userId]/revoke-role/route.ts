/**
 * API PROXY - REVOKE ROLE FROM USER
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { cookies } from 'next/headers';

const API_BASE_URL = getApiBaseUrlForRoutes();

async function getAuthHeaders(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;
  const authHeader = request.headers.get('Authorization');
  return {
    Authorization: authHeader || (sessionToken ? `Bearer ${sessionToken}` : ''),
    'Content-Type': 'application/json',
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const headers = await getAuthHeaders(request);
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await fetch(
      `${API_BASE_URL}/api/settings/users/${userId}/revoke-role${qs}`,
      { method: 'POST', headers, body: JSON.stringify(body) },
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error revoking role:', error);
    return NextResponse.json({ error: 'Failed to revoke role' }, { status: 500 });
  }
}
