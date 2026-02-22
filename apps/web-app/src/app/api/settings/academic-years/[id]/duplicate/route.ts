/**
 * API PROXY - DUPLIQUER CONFIGURATION ANNÉE SCOLAIRE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getServerToken } from '@/lib/auth/session';

const API_BASE_URL = getApiBaseUrlForRoutes();

async function getAuthHeaders(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const cookieToken = request.cookies.get('academia_token')?.value;
  const sessionToken = await getServerToken();
  const token = authHeader || (cookieToken ? `Bearer ${cookieToken}` : '') || (sessionToken ? `Bearer ${sessionToken}` : '');
  return { 'Authorization': token, 'Content-Type': 'application/json' };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const headers = await getAuthHeaders(request);
    const response = await fetch(`${API_BASE_URL}/settings/academic-years/${id}/duplicate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error duplicating academic year:', error);
    return NextResponse.json({ error: 'Failed to duplicate academic year' }, { status: 500 });
  }
}
