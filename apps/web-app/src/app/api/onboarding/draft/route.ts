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
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiBaseUrl = getApiBaseUrlForRoutes();
    // getApiBaseUrl() retourne déjà l'URL avec /api à la fin
    const draftUrl = `${apiBaseUrl}/onboarding/draft`;

    const response = await fetch(draftUrl, {
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
    // getApiBaseUrl() retourne déjà l'URL avec /api à la fin
    const draftUrl = `${apiBaseUrl}/onboarding/draft/${draftId}`;

    const response = await fetch(draftUrl, {
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
