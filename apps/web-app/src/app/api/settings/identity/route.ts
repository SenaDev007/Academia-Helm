/**
 * ============================================================================
 * API PROXY - IDENTITÉ ÉTABLISSEMENT
 * ============================================================================
 * Source légale de vérité versionnée
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
    'Authorization': authHeader || (sessionToken ? `Bearer ${sessionToken}` : ''),
    'Content-Type': 'application/json',
  };
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    const response = await fetch(`${API_BASE_URL}/api/settings/identity`, {
      headers,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error fetching identity profile:', error);
    return NextResponse.json({ error: 'Failed to fetch identity profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = await getAuthHeaders(request);
    
    const response = await fetch(`${API_BASE_URL}/api/settings/identity`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating identity version:', error);
    return NextResponse.json({ error: 'Failed to create identity version' }, { status: 500 });
  }
}
