/**
 * ============================================================================
 * API PROXY - TEST WHATSAPP
 * ============================================================================
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

export async function POST(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    
    const response = await fetch(`${API_BASE_URL}/api/settings/communication/test-whatsapp`, {
      method: 'POST',
      headers,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error testing WhatsApp:', error);
    return NextResponse.json({ error: 'Failed to test WhatsApp' }, { status: 500 });
  }
}
