/**
 * ============================================================================
 * API PROXY — SCHOOL EMAIL DISCONNECT : POST /api/school-email/disconnect →
 * supprime tous les secrets de l'école, statut Non configuré.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    // ⭐ 2026-11-26 (double identité) — le corps transporte le niveau ciblé
    //    (levelCategory : MATERNAL_PRIMARY | SECONDARY) : les écoles combinées
    //    déconnectent chaque niveau indépendamment.
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/school-email/disconnect`);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error disconnecting school email:', error);
    return NextResponse.json({ error: 'Failed to disconnect school email' }, { status: 500 });
  }
}
