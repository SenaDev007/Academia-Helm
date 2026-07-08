import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * POST /api/finance/settings/send-compta-export
 * Déclenche manuellement l'envoi de l'export comptable mensuel au comptable.
 * Body : aucun (utilise les paramètres financiers du tenant).
 */
export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const response = await fetch(normalizeApiUrl(`${API_URL}/finance/settings/send-compta-export`), {
      method: 'POST',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
