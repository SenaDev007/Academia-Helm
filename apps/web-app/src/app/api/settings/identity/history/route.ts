/**
 * API PROXY - IDENTITY HISTORY
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getServerToken } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

async function getAuthHeaders(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    return {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    };
  }
  
  const cookieToken = request.cookies.get('academia_token')?.value;
  if (cookieToken) {
    return {
      'Authorization': `Bearer ${cookieToken}`,
      'Content-Type': 'application/json',
    };
  }
  
  const sessionToken = await getServerToken();
  return {
    'Authorization': sessionToken ? `Bearer ${sessionToken}` : '',
    'Content-Type': 'application/json',
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    
    const headers = await getAuthHeaders(request);
    const response = await fetch(
      `${API_BASE_URL}/settings/identity/history?limit=${limit}&offset=${offset}`,
      { headers }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching identity history:', error);
    return NextResponse.json({ error: 'Failed to fetch identity history' }, { status: 500 });
  }
}
