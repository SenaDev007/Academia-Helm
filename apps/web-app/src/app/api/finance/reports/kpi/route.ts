/**
 * Proxy: api/finance/reports/kpi (SM7)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API = getApiBaseUrlForRoutes();

function authHeaders(req: NextRequest) {
  return { Authorization: req.headers.get('Authorization') || '' };
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.toString();
    const res = await fetch(`${API}/api/finance/reports/kpi${q ? `?${q}` : ''}`, { headers: authHeaders(req), credentials: 'include' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
