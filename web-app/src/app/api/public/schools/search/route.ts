/**
 * ============================================================================
 * SCHOOL SEARCH API PROXY - RECHERCHE PUBLIQUE D'ÉTABLISSEMENTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('q');

    if (!searchTerm || searchTerm.length < 2) {
      return NextResponse.json(
        { error: 'Le terme de recherche doit contenir au moins 2 caractères' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/public/schools/search?q=${encodeURIComponent(searchTerm)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('School search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search schools' },
      { status: 500 }
    );
  }
}

