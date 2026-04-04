/**
 * Proxy : création des trimestres par défaut.
 * Chemin Next `.../periods/bootstrap` → Nest `.../periods/create-default`.
 * Le dossier `create-default` provoquait parfois PageNotFoundError (module introuvable) avec le routeur Next.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE = getApiBaseUrlForRoutes();

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const headers = await getProxyAuthHeaders(request);
    if (!headers['Authorization'] && !headers['Cookie']) {
      return NextResponse.json(
        { error: 'Session expirée ou non authentifié.', code: 'UNAUTHORIZED' },
        { status: 401 },
      );
    }
    const url = new URL(`${API_BASE}/settings/academic-years/${id}/periods/create-default`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: (await response.text()) || 'Erreur serveur' };
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error creating default periods:', error);
    return NextResponse.json({ error: 'Failed to create default periods' }, { status: 500 });
  }
}
