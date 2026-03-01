import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const API = getApiBaseUrlForRoutes();
  const res = await fetch(`${API}/api/finance/audit-logs${q ? `?${q}` : ''}`, {
    headers: { Authorization: req.headers.get('Authorization') || '' },
    credentials: 'include',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
