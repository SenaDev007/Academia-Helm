/**
 * API PROXY - ACTIVATE IDENTITY VERSION
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> }
) {
  try {
    const { versionId } = await params;
    const body = await request.json();
    const headers = await getAuthHeaders(request);
    
    const response = await fetch(`${API_BASE_URL}/settings/identity/activate/${versionId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error activating identity version:', error);
    return NextResponse.json({ error: 'Failed to activate identity version' }, { status: 500 });
  }
}
