/**
 * API PROXY - Structure pedagogique (niveaux, cycles, grades)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/settings/education/structure`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching education structure:', error);
    return NextResponse.json({ error: 'Failed to fetch structure' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    if (!headers['Authorization'] && !headers['Cookie']) {
      return NextResponse.json({ error: 'Non authentifie', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/education/structure/initialize`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { method: 'POST', headers });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error initializing education structure:', error);
    return NextResponse.json({ error: 'Failed to initialize' }, { status: 500 });
  }
}
