/**
 * Proxy vers GET /auth/dev-available-tenants (liste des écoles en mode dev, sans auth)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getApiBaseUrlForRoutes,
  normalizeApiUrl,
} from '@/lib/utils/api-urls';

/** Évite les attentes de plusieurs minutes si l’API Nest n’est pas démarrée */
const DEV_PROXY_TIMEOUT_MS = Number(
  process.env.DEV_API_PROXY_TIMEOUT_MS ?? 15_000,
);

export async function GET(_request: NextRequest) {
  try {
    // En production, le proxy est autorisé : l’API Nest refuse la liste tant que
    // PLATFORM_OWNER_MODE n’est pas activé (même principe que /api/public/schools/list).

    const apiBaseUrl = getApiBaseUrlForRoutes();
    const path = apiBaseUrl.endsWith('/api')
      ? `${apiBaseUrl}/auth/dev-available-tenants`
      : `${apiBaseUrl}/api/auth/dev-available-tenants`;
    const url = normalizeApiUrl(path);

    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(DEV_PROXY_TIMEOUT_MS),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.message.toLowerCase().includes('timeout') ||
        (error as NodeJS.ErrnoException).code === 'ABORT_ERR');

    console.error('[Dev Available Tenants API] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch dev available tenants',
        hint: isTimeout
          ? `Pas de réponse du backend dans ${DEV_PROXY_TIMEOUT_MS / 1000}s. Démarrez l’API Nest (apps/api-server : npm run start:dev) et vérifiez API_PORT (défaut 3000) ou NEXT_PUBLIC_API_URL.`
          : "Vérifiez que l'API est joignable (ex. http://127.0.0.1:3000/api).",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
}
