/**
 * API PROXY - Re-seed de la structure pédagogique EN (Nursery 1/2, Primary 1-6)
 *
 * Appelle POST /settings/bilingual/seed-en-structure sur le backend NestJS.
 * Utile si l'auto-seed à l'activation bilingue a échoué, ou si de nouvelles
 * classes FR ont été ajoutées après l'activation et qu'on veut créer leurs
 * miroirs EN.
 *
 * Opération idempotente — peut être appelée plusieurs fois sans effet de bord.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(request: NextRequest) {
  try {
    const headers = await getProxyAuthHeaders(request);
    const hasAuth = headers['Authorization'] || headers['Cookie'];
    if (!hasAuth) {
      return NextResponse.json({ error: 'Non authentifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }
    const url = new URL(`${API_BASE_URL}/settings/bilingual/seed-en-structure`);
    const fromQuery = request.nextUrl?.searchParams?.get('tenant_id');
    if (fromQuery) url.searchParams.set('tenant_id', fromQuery);
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error seeding EN bilingual structure:', error);
    return NextResponse.json({ error: 'Failed to seed EN structure' }, { status: 500 });
  }
}
