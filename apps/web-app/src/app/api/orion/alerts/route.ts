/**
 * ============================================================================
 * API PROXY - ORION ALERTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/api/orion/alerts${queryString ? `?${queryString}` : ''}`;

    const headers: HeadersInit = {};
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers['Authorization'] = auth;
    if (cookie) headers['cookie'] = cookie;

    const response = await fetch(url, { headers });

    if (!response.ok) {
      // En mode dégradé, retourner une liste vide plutôt qu'une 500.
      // IMPORTANT: les consommateurs attendent un tableau (et font .slice/.length).
      // Éviter le spam terminal en cas de 401 attendu (droits ORION non accordés).
      if (response.status !== 401) {
        console.error('ORION alerts backend returned', response.status);
      }
      return NextResponse.json([]);
    }

    const data = await response.json();
    // Normaliser la forme de la réponse pour toujours renvoyer un tableau.
    if (Array.isArray(data)) {
      return NextResponse.json(data);
    }
    if (data && Array.isArray((data as any).alerts)) {
      return NextResponse.json((data as any).alerts);
    }
    return NextResponse.json([]);
  } catch (error) {
    console.error('Error fetching ORION alerts:', error);
    // Mode dégradé : pas d'erreur bloquante pour le dashboard
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookie = request.headers.get('cookie');
    if (auth) headers['Authorization'] = auth;
    if (cookie) headers['cookie'] = cookie;

    const response = await fetch(`${API_BASE_URL}/api/orion/alerts/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error('Error generating ORION alerts backend:', response.status);
      return NextResponse.json({ success: false });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error generating alerts:', error);
    return NextResponse.json({ success: false });
  }
}
