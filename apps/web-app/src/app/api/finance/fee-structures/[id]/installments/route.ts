import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API = getApiBaseUrlForRoutes();

function authHeaders(req: NextRequest) {
  return { Authorization: req.headers.get('Authorization') || '' };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const body = await req.json();
    const res = await fetch(`${API}/api/finance/fees/${id}/installments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(req) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
