import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API = getApiBaseUrlForRoutes();

function authHeaders(req: NextRequest) {
  return { Authorization: req.headers.get('Authorization') || '' };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.toString();
  const res = await fetch(`${API}/api/finance/expenses-v2/budgets${q ? `?${q}` : ''}`, {
    headers: authHeaders(req),
    credentials: 'include',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API}/api/finance/expenses-v2/budgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(req) },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
