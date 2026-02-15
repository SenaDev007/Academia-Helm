/**
 * ============================================================================
 * ONBOARDING PAYMENT VERIFY API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour vérifier le statut d'un paiement côté backend
 * 
 * ⚠️ CRITIQUE : Le frontend ne doit JAMAIS faire confiance au callback onComplete.
 * Il doit toujours appeler cet endpoint pour vérifier le statut réel depuis FedaPay.
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const { paymentId } = params;

    if (!paymentId) {
      return NextResponse.json(
        { error: 'paymentId is required' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const verifyUrl = `${apiBaseUrl}/onboarding/payment/${paymentId}/verify`;

    console.log('🔍 [Payment Verify] API URL:', verifyUrl);

    let response: Response;
    try {
      const finalUrl = normalizeApiUrl(verifyUrl);
      response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30 secondes
      });
    } catch (fetchError: any) {
      console.error('❌ [Payment Verify] Fetch error:', fetchError);
      if (fetchError.code === 'EACCES' || fetchError.message?.includes('ECONNREFUSED') || fetchError.message?.includes('fetch failed')) {
        return NextResponse.json(
          {
            error: 'Backend server not accessible',
            message: `Impossible de se connecter au serveur backend. Vérifiez que le serveur API est démarré sur ${apiBaseUrl}`,
          },
          { status: 503 }
        );
      }
      throw fetchError;
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Payment Verify] Backend error:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Payment verify API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify payment status',
        message: error.message || 'Erreur lors de la vérification du statut du paiement',
      },
      { status: 500 }
    );
  }
}
