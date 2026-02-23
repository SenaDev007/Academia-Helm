/**
 * API PROXY - Classes physiques (par année scolaire)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const academicYearId = request.nextUrl?.searchParams?.get('academic_year_id');
    if (!academicYearId) {
      return NextResponse.json({ error: 'academic_year_id requis' }, { status: 400 });
    }
    const url = new URL(`${API_BASE_URL}/settings/education/classrooms`);
    url.searchParams.set('academic_year_id', academicYearId);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching classrooms:', error);
    return NextResponse.json({ error: 'Failed to fetch classrooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    if (!headers['Authorization']) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/education/classrooms`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating classroom:', error);
    return NextResponse.json({ error: 'Failed to create classroom' }, { status: 500 });
  }
}
