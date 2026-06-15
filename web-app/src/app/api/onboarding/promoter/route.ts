/**
 * ============================================================================
 * ONBOARDING PROMOTER API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /onboarding/draft/:draftId/promoter
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
    // getApiBaseUrlForRoutes() retourne déjà l'URL avec /api à la fin
    const promoterUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/promoter`;

    console.log('🔍 [Onboarding Promoter] API URL:', promoterUrl);
    console.log('🔍 [Onboarding Promoter] API Base URL:', apiBaseUrl);

    // Mapper les champs frontend -> backend
    const backendBody = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      password: body.password,
      otpCode: body.otp, // Frontend envoie 'otp', backend attend 'otpCode'
    };

    let response: Response;
    try {
      // ⚠️ IMPORTANT : Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
      // pour éviter les erreurs EACCES dans les routes API Next.js
      const finalUrl = normalizeApiUrl(promoterUrl);
      
      response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendBody),
        // Ajouter un timeout pour éviter les attentes infinies
        signal: AbortSignal.timeout(30000), // 30 secondes
      });
    } catch (fetchError: any) {
      console.error('❌ [Onboarding Promoter] Fetch error:', fetchError);
      console.error('❌ [Onboarding Promoter] Error code:', fetchError.code);
      console.error('❌ [Onboarding Promoter] Error message:', fetchError.message);
      
      // Vérifier si c'est une erreur de connexion
      if (fetchError.code === 'EACCES' || fetchError.message?.includes('ECONNREFUSED') || fetchError.message?.includes('fetch failed')) {
        return NextResponse.json(
          { 
            error: 'Backend server not accessible',
            message: `Impossible de se connecter au serveur backend. Vérifiez que le serveur API est démarré sur ${apiBaseUrl}`,
            details: {
              apiUrl: promoterUrl,
              apiBaseUrl,
              errorCode: fetchError.code,
              errorMessage: fetchError.message,
            }
          },
          { status: 503 } // Service Unavailable
        );
      }
      
      throw fetchError;
    }

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding promoter API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add promoter info',
        message: error.message || 'Erreur lors de l\'ajout des informations promoteur'
      },
      { status: 500 }
    );
  }
}
