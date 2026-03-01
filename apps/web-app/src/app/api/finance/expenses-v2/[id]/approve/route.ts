import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const API = getApiBaseUrlForRoutes();
  const res = await fetch(`${API}/api/finance/expenses-v2/${id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: req.headers.get('Authorization') || '' },
    credentials: 'include',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
