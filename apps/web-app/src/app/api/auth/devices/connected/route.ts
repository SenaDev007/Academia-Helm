/**
 * Proxy GET vers backend : appareils connectés du tenant (tenant-scoped)
 * GET /api/auth/devices/connected?period=30d|month|quarter|year
 *
 * ⭐ 2026-11-27 — la route BFF manquait : l'onglet Paramètres → Appareils
 *    autorisés appelait /api/auth/devices/connected qui était intercepté par
 *    la route dynamique [deviceId] (GET → 405). C'est l'une des raisons pour
 *    lesquelles l'onglet n'affichait rien.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  const headers: HeadersInit = {};
  const auth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (auth) headers['Authorization'] = auth;
  if (cookie) headers['cookie'] = cookie;

  const period = request.nextUrl.searchParams.get('period') || '30d';
  const tenantId = request.nextUrl.searchParams.get('tenant_id') || request.headers.get('x-tenant-id') || '';
  const qs = new URLSearchParams({ period });
  if (tenantId) qs.set('tenant_id', tenantId);

  try {
    const res = await fetch(`${API_URL}/auth/devices/connected?${qs.toString()}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Connected devices error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}
