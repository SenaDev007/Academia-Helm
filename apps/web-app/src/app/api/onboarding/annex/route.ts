/**
 * ============================================================================
 * ONBOARDING ANNEX API ROUTE — Création du draft annexe (multi-écoles)
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend POST /onboarding/annex.
 * Crée le draft d'onboarding de l'école annexe pour le promoteur
 * AUTHENTIFIÉ (infos promoteur pré-remplies depuis son compte — aucune
 * validation d'agent n'est requise). Le plan est sélectionné immédiatement
 * (snapshot de prix) ; le flux de signature de contrat EXISTANT s'applique
 * ensuite (contrat conforme au Word + activation + UserTenant).
 *
 * Relais Authorization strict.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header missing' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const apiBase = getApiBaseUrlForRoutes();
    const url = new URL(`${apiBase}/onboarding/annex`);

    const response = await fetch(normalizeApiUrl(url.toString()), {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in annex creation:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 },
    );
  }
}
