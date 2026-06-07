/**
 * ============================================================================
 * PORTAL REDIRECT LOG API - ACADEMIA HUB
 * ============================================================================
 * 
 * Endpoint pour logger les redirections tenant
 * Utilisé pour analytics et audit de sécurité
 * 
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

/**
 * POST /api/portal/redirect-log
 * 
 * Log une redirection tenant
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Valider les données
    if (!body.tenantSlug || !body.toUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantSlug, toUrl' },
        { status: 400 }
      );
    }

    // Envoyer au backend pour stockage
    const apiBaseUrl = getApiBaseUrlForRoutes();
    const response = await fetch(`${apiBaseUrl}/portal/redirect-log`, {
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
      console.error('Failed to log redirect to backend:', await response.text());
      // Ne pas échouer la requête si le logging échoue
      return NextResponse.json({ success: true, logged: false });
    }

    return NextResponse.json({ success: true, logged: true });
  } catch (error) {
    console.error('Error logging redirect:', error);
    // Ne pas échouer la requête si le logging échoue
    return NextResponse.json({ success: true, logged: false });
  }
}
