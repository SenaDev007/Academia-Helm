/**
 * ============================================================================
 * ONBOARDING DRAFT CHECK API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour vérifier si un draft existe pour un email
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function GET(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  try {
    const { email } = params;
    
    if (!email) {
      return NextResponse.json(
        { error: 'email parameter is required' },
        { status: 400 }
      );
    }

    // Décoder l'email (il est encodé dans l'URL)
    const decodedEmail = decodeURIComponent(email);

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const checkUrl = `${apiBaseUrl}/onboarding/draft/check/${encodeURIComponent(decodedEmail)}`;
    
    // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
    const finalUrl = normalizeApiUrl(checkUrl);

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding draft check API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to check draft',
        message: error.message || 'Erreur lors de la vérification du draft'
      },
      { status: 500 }
    );
  }
}
