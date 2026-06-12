/**
 * Onboarding API Route
 *
 * POST /api/onboarding : DÉPRÉCIÉ — Utiliser le wizard /signup (draft → promoteur → plan → paiement FedaPay).
 * GET /api/onboarding/check-subdomain : Vérifie la disponibilité d'un sous-domaine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { validateSubdomain } from '@/lib/utils/subdomain';

/**
 * POST /api/onboarding
 *
 * @deprecated Utiliser la page /signup et le flux d'onboarding en 4 phases (draft, promoteur, plan, paiement FedaPay).
 * Cette route ne gère pas le paiement ni l'activation via FedaPay.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: 'Cette route est dépréciée.',
      message: 'Utilisez la page d\'inscription /signup pour créer votre établissement (wizard 4 phases avec paiement FedaPay).',
      redirectUrl: '/signup',
    },
    { status: 410 }
  );
}

/**
 * GET /api/onboarding/check-subdomain?subdomain=xxx
 * 
 * Vérifie la disponibilité d'un sous-domaine
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const subdomain = searchParams.get('subdomain');

  if (!subdomain) {
    return NextResponse.json(
      { error: 'Paramètre subdomain requis' },
      { status: 400 }
    );
  }

  // Valider le format
  const validation = validateSubdomain(subdomain);
  if (!validation.valid) {
    return NextResponse.json(
      { available: false, error: validation.error },
      { status: 400 }
    );
  }

  // Vérifier la disponibilité
  const API_URL = getApiBaseUrlForRoutes();
  
  try {
    const response = await fetch(`${API_URL}/tenants/by-subdomain/${subdomain}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    // Si 404, le sous-domaine est disponible
    const available = response.status === 404;

    return NextResponse.json({
      available,
      subdomain,
    });
  } catch (error) {
    // En cas d'erreur, considérer comme disponible
    return NextResponse.json({
      available: true,
      subdomain,
    });
  }
}

