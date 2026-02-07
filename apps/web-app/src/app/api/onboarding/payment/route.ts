/**
 * ============================================================================
 * ONBOARDING PAYMENT API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /onboarding/draft/:draftId/payment
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    // getApiBaseUrl() retourne déjà l'URL avec /api à la fin
    const paymentUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/payment`;

    // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
    const finalUrl = normalizeApiUrl(paymentUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding payment API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create payment session',
        message: error.message || 'Erreur lors de la création de la session de paiement'
      },
      { status: 500 }
    );
  }
}
