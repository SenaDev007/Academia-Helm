/**
 * ============================================================================
 * ONBOARDING DRAFT — MISE À JOUR DES INFOS ÉTABLISSEMENT
 * ============================================================================
 *
 * Proxy Next.js pour l'endpoint backend POST /onboarding/draft/:draftId/school.
 *
 * ⭐ Corrige « les corrections après retour ne sont pas prises en compte » :
 *    quand l'utilisateur du wizard revient à l'étape 1 (ou depuis le contrat)
 *    pour corriger — option bilingue, nom, ville, sous-domaine, effectif —
 *    les corrections sont propagées au DRAFT (donc à l'activation du tenant,
 *    aux emails, à la signature différée et au contrat généré du draft).
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

    const body = await request.json().catch(() => ({}));

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const targetUrl = `${apiBaseUrl}/onboarding/draft/${encodeURIComponent(draftId)}/school`;
    const finalUrl = normalizeApiUrl(targetUrl);

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.get('authorization')
          ? { Authorization: request.headers.get('authorization') as string }
          : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json().catch(() => ({ error: 'Invalid response' }))
      : { error: (await response.text()) || 'Erreur serveur' };

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('Error updating draft school info:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update draft school info' },
      { status: 500 },
    );
  }
}
