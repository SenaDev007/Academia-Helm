/**
 * BFF ROUTE — Exam Frauds catch-all (proxy vers NestJS)
 *
 * Gère les sous-routes :
 *   GET    /api/exam-frauds/:id          — Détail
 *   PUT    /api/exam-frauds/:id          — Mise à jour
 *   DELETE /api/exam-frauds/:id          — Annulation
 *   POST   /api/exam-frauds/:id/sanctions — Appliquer sanction
 *   POST   /api/exam-frauds/sanctions/:sid/approve
 *   POST   /api/exam-frauds/sanctions/:sid/execute
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

async function handler(request: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const path = params.path.join('/');
    const method = request.method;
    const { searchParams } = new URL(request.url);

    const backendUrl = new URL(`${API_URL}/exam-frauds/${path}`);
    searchParams.forEach((value, key) => backendUrl.searchParams.append(key, value));

    const headers = await getProxyAuthHeaders(request);

    const fetchOptions: any = {
      method,
      headers,
      cache: 'no-store',
    };

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      headers['Content-Type'] = 'application/json';
      try {
        const body = await request.json();
        fetchOptions.body = JSON.stringify(body);
      } catch {
        // pas de body JSON
      }
    }

    const response = await fetchWithTimeout(
      normalizeApiUrl(backendUrl.toString()),
      fetchOptions,
      15000,
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json({ error: 'Backend error', detail: data }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF exam-frauds/[...path]] Error:', error.message);
    return NextResponse.json({ error: 'Failed', detail: error.message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
