/**
 * ============================================================================
 * API PROXY — SCHOOL EMAIL TEST : POST /api/school-email/test → envoie un
 * e-mail de test à l'adresse de l'utilisateur connecté (max 5/heure/école).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const headers = await getProxyAuthHeaders(request);
    const url = new URL(`${API_BASE_URL}/school-email/test`);
    const response = await fetchWithTimeout(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }, 90000); // wait:true côté API — l'envoi SMTP réel est attendu
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Error sending school email test:', error);
    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
