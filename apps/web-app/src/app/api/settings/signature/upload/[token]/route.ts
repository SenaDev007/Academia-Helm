/**
 * Proxy API — Upload d'une signature via magic-link token (PUBLIC, no auth)
 * POST /api/settings/signature/upload/:token
 *
 * ⭐ 2026-09-16 — FIX du flux « Lien signature » (RH → Administration) :
 *    la page publique /signature/canvas/[token] POSTait sur cette URL alors
 *    qu'AUCUNE route BFF n'existait ici → 404 systématique : le staff dessinait
 *    sa signature puis la soumission échouait. Le backend NestJS expose bien
 *    POST /settings/signature/upload/:token (@Public, authentifié par le
 *    token) — ce proxy le relaie désormais.
 *
 * Next.js 16 : `params` est une Promise à awaiter (cf. token-info).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const url = new URL(`${API_BASE_URL}/settings/signature/upload/${token}`);
    const response = await fetchWithTimeout(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 30000);
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Error uploading signature by token:', error);
    return NextResponse.json({ error: 'Failed to upload signature' }, { status: 500 });
  }
}
