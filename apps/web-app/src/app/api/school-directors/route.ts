import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/school-directors?userId=<uuid>
 * Résout la fiche « directeur d'école » (signature + cachets) de l'utilisateur
 * connecté — utilisée par la Validation Direction (DirectorPedagogyControl FR/EN)
 * pour charger la signature avant de valider/rejeter une planification mensuelle.
 *
 * Avant cette route : le frontend appelait /api/school-directors qui n'existait
 * pas côté BFF → 404 avalé silencieusement → directorSignature
 * toujours null → le bouton « Valider » était systématiquement bloqué par le
 * toast « Signature du directeur requise ».
 *
 * Chaîne : backend hr/school-directors.controller.ts @Get() (liste des
 * directeurs actifs du tenant, jointure staff) → on renvoie l'entrée
 * correspondant à l'utilisateur (staffUserId === userId), à défaut la première
 * fiche active du tenant (petites écoles mono-directeur).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const headers = await getProxyAuthHeaders(request);
    const r = await fetchWithTimeout(normalizeApiUrl(`${API_URL}/hr/school-directors`), {
      headers,
      cache: 'no-store',
    }, 15000);
    if (!r.ok) {
      return NextResponse.json(
        { message: 'Impossible de charger les directeurs' },
        { status: r.status },
      );
    }
    const directors = await r.json().catch(() => []);
    if (!Array.isArray(directors) || directors.length === 0) {
      return NextResponse.json(null, { status: 404 });
    }
    const match =
      (userId && directors.find((d: any) => d?.staffUserId && d.staffUserId === userId)) ||
      directors.find((d: any) => d?.signatureDataUrl || d?.signatureUploadedUrl) ||
      directors[0];
    return NextResponse.json(match ?? null, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
