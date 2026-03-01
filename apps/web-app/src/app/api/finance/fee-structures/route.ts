/**
 * Proxy vers backend Nest: api/finance/fees (FeeStructure)
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
    const res = await fetch(`${API}/api/finance/fees${q ? `?${q}` : ''}`, { headers: authHeaders(req) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Fee structures GET:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${API}/api/finance/fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(req) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('Fee structures POST:', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
