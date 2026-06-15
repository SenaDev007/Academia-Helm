/**
 * ============================================================================
 * PORTAL ACCESS LOG API - ACADEMIA HUB
 * ============================================================================
 * 
 * Endpoint pour logger les tentatives d'accès aux routes /app
 * Utilisé pour détecter les tentatives d'accès non autorisées
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

/**
 * POST /api/portal/access-log
 * 
 * Log une tentative d'accès à une route protégée
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valider les données
    if (!body.path || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: path, reason' },
        { status: 400 }
      );
    }

    // Envoyer au backend pour stockage/analyse
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const response = await fetch(`${apiBaseUrl}/portal/access-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        ...body,
        timestamp: body.timestamp || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error('Failed to log access to backend:', await response.text());
      // Ne pas échouer la requête si le logging échoue
      return NextResponse.json({ success: true, logged: false });
    }

    return NextResponse.json({ success: true, logged: true });
  } catch (error) {
    console.error('Error logging access:', error);
    // Ne pas échouer la requête si le logging échoue
    return NextResponse.json({ success: true, logged: false });
  }
}
