/**
 * ============================================================================
 * AVAILABLE TENANTS API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /auth/available-tenants
 * Accepte le token via Authorization ou via le cookie de session (PO après login).
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerToken } from '@/lib/auth/session';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim() || await getServerToken();
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization header or session cookie required' },
        { status: 401 }
      );
    }

    const baseUrl = normalizeApiUrl(getApiBaseUrlForRoutes());
    const url = `${baseUrl.replace(/\/$/, '')}/auth/available-tenants`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in available tenants:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
