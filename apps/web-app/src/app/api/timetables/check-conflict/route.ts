/**
 * ============================================================================
 * BFF ROUTE — Timetables Check Conflict (proxy vers NestJS)
 * ============================================================================
 *
 * POST /api/timetables/check-conflict
 *   Dry-run : vérifie les conflits d'emploi du temps SANS créer l'entry.
 *   Utilisé pour l'UX préventive (afficher les conflits en temps réel
 *   pendant que le censeur remplit le formulaire).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    headers['Content-Type'] = 'application/json';

    const response = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/timetables/check-conflict`),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      },
      10000,
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend error', detail: data },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[BFF timetables/check-conflict] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to check conflict', detail: error.message },
      { status: 500 },
    );
  }
}
