/**
 * ============================================================================
 * API PROXY — PROFIL UTILISATEUR CONNECTÉ (Mon profil)
 * ============================================================================
 *
 * GET /api/users/me/profile
 *   → proxy vers GET {API}/users/me/profile (champs sûrs : identité + avatar)
 *
 * Pattern identique à /api/settings/identity : getProxyAuthHeaders
 * (Authorization Bearer + cookies transmis au backend NestJS).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/users/me/profile`);
    const response = await fetchWithTimeout(
      normalizeApiUrl(url.toString()),
      { headers, cache: 'no-store' },
      15000
    );
    const data = await response.json().catch(() => null);
    return NextResponse.json(data, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
}
