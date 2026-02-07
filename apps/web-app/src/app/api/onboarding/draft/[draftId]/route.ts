/**
 * ============================================================================
 * ONBOARDING DRAFT DELETE API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour supprimer un draft d'onboarding
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(
  request: NextRequest,
  { params }: { params: { draftId: string } }
) {
  try {
    const { draftId } = params;
    
    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId is required' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const draftUrl = `${apiBaseUrl}/onboarding/draft/${draftId}/delete`;

    console.log('🔍 [Onboarding Draft Delete] API URL:', draftUrl);

    // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
    const finalUrl = normalizeApiUrl(draftUrl);
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000), // 30 secondes
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [Onboarding Draft Delete] Backend error:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding draft delete API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete onboarding draft',
        message: error.message || 'Erreur lors de la suppression du draft'
      },
      { status: 500 }
    );
  }
}
