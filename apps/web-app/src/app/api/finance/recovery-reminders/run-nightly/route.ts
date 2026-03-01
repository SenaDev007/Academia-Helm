import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API = getApiBaseUrlForRoutes();

export async function POST(req: NextRequest) {
  try {
    const res = await fetch(`${API}/api/finance/recovery-reminders/run-nightly`, {
      method: 'POST',
      headers: { Authorization: req.headers.get('Authorization') || '' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
