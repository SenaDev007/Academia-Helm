/**
 * Proxy GET vers backend : historique de connexion paginé (tenant-scoped)
 * GET /api/auth/devices/login-history?page=&limit=&action=&status=
 *
 * ⭐ 2026-11-27 — la route BFF manquait (interception par [deviceId] → 405).
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

  const sp = request.nextUrl.searchParams;
  const tenantId = sp.get('tenant_id') || request.headers.get('x-tenant-id') || '';
  const qs = new URLSearchParams();
  for (const key of ['page', 'limit', 'userId', 'action', 'status', 'from', 'to']) {
    const v = sp.get(key);
    if (v) qs.set(key, v);
  }
  if (tenantId) qs.set('tenant_id', tenantId);

  try {
    const res = await fetch(`${API_URL}/auth/devices/login-history?${qs.toString()}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Login history error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}
