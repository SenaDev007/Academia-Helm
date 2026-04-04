/**
 * ============================================================================
 * ONBOARDING DRAFT API ROUTE
 * ============================================================================
 * 
 * Proxy Next.js pour l'endpoint backend /onboarding/draft
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiBaseUrl = getApiBaseUrlForRoutes();
    // getApiBaseUrlForRoutes() retourne déjà l'URL avec /api à la fin
    const draftUrl = `${apiBaseUrl}/onboarding/draft`;
    
    console.log('🔍 [Onboarding Draft] API URL:', draftUrl);
    console.log('🔍 [Onboarding Draft] Request body:', JSON.stringify(body, null, 2));

    let response: Response;
    try {
      // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
      const finalUrl = normalizeApiUrl(draftUrl);
      response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000), // 30 secondes
      });
    } catch (fetchError: any) {
      console.error('❌ [Onboarding Draft] Fetch error:', fetchError);
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

    const raw = await response.text();
    let data: Record<string, unknown> = {};
    if (raw) {
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.error('❌ [Onboarding Draft] Réponse non-JSON du backend:', raw.slice(0, 500));
        return NextResponse.json(
          {
            error: 'Réponse invalide du serveur API',
            message: `HTTP ${response.status} — le backend n’a pas renvoyé du JSON (vérifiez les migrations Prisma et les logs Railway).`,
          },
          { status: 502 },
        );
      }
    }

    if (!response.ok) {
      console.error('❌ [Onboarding Draft] Backend error:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Onboarding draft API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create onboarding draft',
        message: error.message || 'Erreur lors de la création du draft'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json(
        { error: 'draftId parameter is required' },
        { status: 400 }
      );
    }

    const apiBaseUrl = getApiBaseUrlForRoutes();
    // getApiBaseUrlForRoutes() retourne déjà l'URL avec /api à la fin
    const draftUrl = `${apiBaseUrl}/onboarding/draft/${draftId}`;
    
    // Normaliser l'URL pour utiliser 127.0.0.1 au lieu de localhost
    const finalUrl = normalizeApiUrl(draftUrl);

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
    console.error('Get onboarding draft API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get onboarding draft',
        message: error.message || 'Erreur lors de la récupération du draft'
      },
      { status: 500 }
    );
  }
}
