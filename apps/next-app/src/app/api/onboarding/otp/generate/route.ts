/**
 * ============================================================================
 * ONBOARDING OTP GENERATE API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour générer et envoyer un code OTP
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, phone, method } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      );
    }

    // Valider la méthode si fournie
    if (method && !['sms', 'voice', 'whatsapp'].includes(method)) {
      return NextResponse.json(
        { error: 'method must be one of: sms, voice, whatsapp' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const otpUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/otp/generate`;

    console.log('🔍 [OTP Generate] API URL:', otpUrl, 'Method:', method || 'sms');

    let response: Response;
    try {
      // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
      const finalUrl = normalizeApiUrl(otpUrl);
      response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, method: method || 'sms' }),
        signal: AbortSignal.timeout(30000), // 30 secondes
      });
    } catch (fetchError: any) {
      console.error('❌ [OTP Generate] Fetch error:', fetchError);
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
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding OTP generate API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate OTP',
        message: error.message || 'Erreur lors de la génération du code OTP'
      },
      { status: 500 }
    );
  }
}
