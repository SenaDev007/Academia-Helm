import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/transactions/:id/resend
 * Renvoie le reçu par email/WhatsApp/SMS au parent.
 * Body: { channels: ['email', 'whatsapp', 'sms'] }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(
      normalizeApiUrl(`${API_URL}/finance/transactions/${id}/resend`),
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    30000);
    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status });
  } catch (error) {
    console.error('Error resending receipt:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
