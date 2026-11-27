/**
 * Proxy POST vers backend : approuver un appareil en attente (tenant-scoped)
 * POST /api/auth/devices/:deviceId/approve
 *
 * ⭐ 2026-11-27 — la route BFF manquait (404) : le bouton « Approuver » de
 *    l'onglet Paramètres → Appareils autorisés ne fonctionnait jamais.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  }
  const headers: HeadersInit = {};
  const auth = request.headers.get('authorization');
  const cookie = request.headers.get('cookie');
  if (auth) headers['Authorization'] = auth;
  if (cookie) headers['cookie'] = cookie;

  const tenantId = request.nextUrl.searchParams.get('tenant_id') || request.headers.get('x-tenant-id') || '';
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';

  try {
    const res = await fetch(`${API_URL}/auth/devices/${encodeURIComponent(deviceId)}/approve${qs}`, {
      method: 'POST',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Approve device error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}
