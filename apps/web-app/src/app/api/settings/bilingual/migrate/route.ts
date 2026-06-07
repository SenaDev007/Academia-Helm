/**
 * API PROXY - Lancer la migration bilingue
 * Même pattern que education/classrooms (POST).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const hasAuth = headers['Authorization'] || headers['Cookie'];
    if (!hasAuth) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/bilingual/migrate`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error starting bilingual migration:', error);
    return NextResponse.json({ error: 'Failed to start migration' }, { status: 500 });
  }
}
