/**
 * ============================================================================
 * API PROXY - IDENTITÉ ÉTABLISSEMENT
 * ============================================================================
 * Source légale de vérité versionnée
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getServerToken } from '@/lib/auth/session';

async function getAuthHeaders(request: NextRequest) {
  // Priorité 1: Header Authorization existant
  const authHeader = request.headers.get('Authorization');
  
  // Priorité 2: Cookie academia_token via request.cookies
  const cookieToken = request.cookies.get('academia_token')?.value;
  
  // Priorité 3: Utiliser la fonction session
  const sessionToken = await getServerToken();
  
  const token = authHeader || (cookieToken ? `Bearer ${cookieToken}` : '') || (sessionToken ? `Bearer ${sessionToken}` : '');
  
  return {
    'Authorization': token,
    'Content-Type': 'application/json',
  };
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders(request);
    const baseUrl = normalizeApiUrl(getApiBaseUrlForRoutes());
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/settings/identity`, {
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text || text.trim() === '') {
      return NextResponse.json(null, { status: response.status });
    }
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: text || 'Invalid response' }, { status: response.status });
    }
    const data = JSON.parse(text);
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
    
    const baseUrl = normalizeApiUrl(getApiBaseUrlForRoutes());
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/settings/identity`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text || text.trim() === '') {
      return NextResponse.json({ success: true }, { status: response.status });
    }
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: text || 'Invalid response' }, { status: response.status });
    }
    const data = JSON.parse(text);
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating identity version:', error);
    return NextResponse.json({ error: 'Failed to create identity version' }, { status: 500 });
  }
}
