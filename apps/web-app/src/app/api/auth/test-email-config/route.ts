import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

/**
 * Route BFF proxy pour le diagnostic de la configuration email.
 * Transmet la requête au backend NestJS et retourne les résultats.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const endpoint = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/test-email-config`
      : `${apiBaseUrl}/api/auth/test-email-config`;

    const backendResponse = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: body.email }),
    });

    const data = await backendResponse.json();

    return NextResponse.json(data, { status: backendResponse.status });
  } catch (error: any) {
    console.error('[Test Email Config API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur de connexion au serveur backend',
        details: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
