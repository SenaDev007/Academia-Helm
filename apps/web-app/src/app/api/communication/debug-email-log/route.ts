/**
 * GET /api/communication/debug-email-log
 *
 * Endpoint temporaire pour diagnostiquer pourquoi les EmailLogs ne sont
 * pas créés. Tente d'insérer un EmailLog de test et retourne l'erreur
 * détaillée si ça échoue.
 *
 * À SUPPRIMER APRÈS DIAGNOSTIC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

const API_BASE_URL = getApiBaseUrlForRoutes();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantId = searchParams.get('tenantId') || '4246cd3c-518a-44bb-a5e0-4109b8eca372';

  try {
    const url = `${API_BASE_URL}/communication/debug-email-log?tenantId=${tenantId}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to call debug endpoint', details: error.message },
      { status: 500 },
    );
  }
}
