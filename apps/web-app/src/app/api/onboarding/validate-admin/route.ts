/**
 * ============================================================================
 * ONBOARDING VALIDATE-ADMIN API ROUTE (BFF)
 * ============================================================================
 *
 * Proxy Next.js vers l'endpoint backend POST /onboarding/validate-admin
 *
 * Valide les credentials d'un compte plateforme (SUPER_ADMIN / Platform Owner)
 * pour le mode YEHI OR Tech. Utilisé par le wizard (étape 2) pour afficher
 * « Identifiants validés » — la validation est REFAITE côté backend à la
 * soumission du promoteur (addPromoterInfo), ce proxy n'est qu'une
 * pré-verification UX.
 *
 * La réponse ne révèle jamais si c'est l'email ou le mot de passe qui est
 * invalide (anti-énumération).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body?.email || !body?.password) {
      return NextResponse.json(
        { valid: false, message: 'Email et mot de passe requis.' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const validateUrl = `${apiBaseUrl}/onboarding/validate-admin`;

    let response: Response;
    try {
      response = await fetch(normalizeApiUrl(validateUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: body.email, password: body.password }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (fetchError: any) {
      if (
        fetchError.code === 'EACCES' ||
        fetchError.message?.includes('ECONNREFUSED') ||
        fetchError.message?.includes('fetch failed')
      ) {
        return NextResponse.json(
          {
            valid: false,
            message: `Impossible de se connecter au serveur backend. Vérifiez que le serveur API est démarré sur ${apiBaseUrl}`,
          },
          { status: 503 },
        );
      }
      throw fetchError;
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[Onboarding validate-admin] Error:', error);
    return NextResponse.json(
      {
        valid: false,
        message: error.message || 'Erreur lors de la validation des identifiants',
      },
      { status: 500 },
    );
  }
}
