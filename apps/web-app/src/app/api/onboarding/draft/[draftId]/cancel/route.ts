/**
 * ============================================================================
 * ONBOARDING DRAFT CANCEL API ROUTE
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend POST /onboarding/draft/:draftId/cancel.
 *
 * Annule un draft d'onboarding EN COURS (statut DRAFT / PENDING_PAYMENT) pour
 * pouvoir en recréer un avec le même e-mail :
 *   - paramètres (résumé du wizard du sign-up) : « un onboarding est déjà en
 *     cours pour cet email… Pour recommencer : annulez le draft en cours
 *     (POST /api/onboarding/draft/:draftId/cancel) puis recréez un draft. »
 *   - utilisé par les paramètres (groupe d'écoles) dans la modal « Onboarding
 *     déjà en cours » → « Annuler le brouillon et recommencer ».
 *
 * Le contrôleur backend OnboardingController est @Public (utilisé pendant
 * l'inscription) — aucun jeton requis.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await params;
  try {
    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 },
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const cancelUrl = `${apiBaseUrl}/onboarding/draft/${encodeURIComponent(draftId)}/cancel`;
    const finalUrl = normalizeApiUrl(cancelUrl);

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('❌ [Onboarding Draft Cancel] Backend error:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding draft cancel API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel onboarding draft',
        message: error.message || 'Erreur lors de l\'annulation du draft',
      },
      { status: 500 },
    );
  }
}
