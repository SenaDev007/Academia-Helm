import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

/**
 * BFF route : GET /api/public/reviews/check-tenant/:tenantId
 *
 * Proxy vers le backend NestJS : GET /reviews/check-tenant/:tenantId
 *
 * Retourne `{ hasReview: boolean, review?: {...} }` pour permettre au frontend
 * de désactiver pro-activement le bouton "Donner mon avis" lorsqu'un tenant
 * a déjà soumis son témoignage.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  if (!tenantId) {
    return NextResponse.json(
      { message: 'tenantId manquant' },
      { status: 400 },
    );
  }

  const API_BASE_URL = getApiBaseUrlForRoutes();
  const path = `${API_BASE_URL}/reviews/check-tenant/${encodeURIComponent(tenantId)}`;
  const apiUrl = normalizeApiUrl(path);

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: bffHeaders(),
      cache: 'no-store',
    });
    const resBody = await response.text();
    return new NextResponse(resBody, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Service indisponible' },
      { status: 502 },
    );
  }
}
