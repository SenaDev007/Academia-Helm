/**
 * API PROXY - Statistiques d'une année scolaire
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
  return { Authorization: token, 'Content-Type': 'application/json' };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headers = await getAuthHeaders(request);
    const response = await fetch(`${API_BASE_URL}/settings/academic-years/${id}/stats`, { headers });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching academic year stats:', error);
    return NextResponse.json({ error: 'Failed to fetch academic year stats' }, { status: 500 });
  }
}
