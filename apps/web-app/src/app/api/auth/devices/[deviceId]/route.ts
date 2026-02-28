/**
 * Proxy DELETE vers backend : révoquer un appareil (tenant-scoped)
 * DELETE /api/auth/otp/devices/:deviceId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_URL = getApiBaseUrlForRoutes();

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const { deviceId } = await params;
  if (!deviceId) {
    return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  }
  const headers: HeadersInit = {};
  const auth = _request.headers.get('authorization') || _request.headers.get('Authorization');
  const cookie = _request.headers.get('cookie');
  if (auth) headers['Authorization'] = auth;
  if (cookie) headers['cookie'] = cookie;

  try {
    const res = await fetch(`${API_URL}/api/auth/otp/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Revoke device error:', e);
    return NextResponse.json({ error: 'Service indisponible' }, { status: 502 });
  }
}
