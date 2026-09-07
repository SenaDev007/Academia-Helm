/**
 * ============================================================================
 * API ROUTE - STUDENT GUARDIANS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

// ⭐ NO CACHE — guardians (phone, email) sont fréquemment modifiés via
//    l'onglet Inscriptions (PUT /students/:id/guardians/:guardianId).
//    Sans 'no-store', Vercel CDN sert une réponse stale jusqu'à 60s + 5min.
const NO_CACHE_HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/${studentId}/guardians`),
      { headers, cache: 'no-store' }
    , 15000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching guardians:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  try {
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/students/${studentId}/guardians`),
      { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    , 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error creating guardian:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

