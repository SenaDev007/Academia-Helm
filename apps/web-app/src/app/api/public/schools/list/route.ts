/**
 * ============================================================================
 * SCHOOL LIST API PROXY - LISTE COMPLÈTE DES ÉTABLISSEMENTS
 * ============================================================================
 *
 * Proxy BFF (Backend-For-Frontend) vers le endpoint NestJS /api/public/schools/list.
 * Ce endpoint est PUBLIC (@Public) — aucune authentification requise.
 *
 * Stratégie de résolution (serveur-à-serveur) :
 *   1. Si API_INTERNAL_URL est défini → appel direct Railway (contourne Cloudflare)
 *   2. Sinon → appel via l'URL publique (api.academiahelm.com)
 *   3. Si l'URL publique est bloquée par Cloudflare (403+HTML) → fallback Railway direct
 *   4. Retry automatique sur erreurs transitoires
 *
 * Cache : Réponse mise en cache pendant 60 secondes (Next.js ISR)
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

/** ISR: revalidate toutes les 60 secondes — les données changent rarement */
export const revalidate = 60;

/** Nombre max de tentatives en cas d'erreur transitoire. */
const MAX_RETRIES = 1;

/** Codes HTTP considérés comme transitoires (réessayable). */
const RETRYABLE_STATUS_CODES = new Set([403, 502, 503, 504]);

/** Délai avant retry (ms). */
const RETRY_DELAY_MS = 800;

/** Timeout augmenté à 30s — le backend peut avoir un cold start Neon. */
const DEFAULT_TIMEOUT = 30_000;

/**
 * URL Railway directe — contourne Cloudflare.
 * Format : https://<railway-app>.up.railway.app
 * Nécessite le header Host pour que Railway route correctement.
 */
const RAILWAY_INTERNAL_ORIGIN = 'https://8nvfmrrz.up.railway.app';

/** Host original de l'API (pour le header Host envoyé à Railway). */
const API_PUBLIC_HOST = 'api.academiahelm.com';

/**
 * Version synchrone de getApiBaseUrl pour éviter les imports circulaires.
 */
function getApiBaseUrlSync(): string {
  // PRIORITÉ 0 : URL interne
  if (typeof window === 'undefined' && process.env.API_INTERNAL_URL) {
    const url = process.env.API_INTERNAL_URL.trim().replace(/\/+$/, '');
    return url.endsWith('/api') ? url : `${url}/api`;
  }
  // PRIORITÉ 1 : NEXT_PUBLIC_API_URL
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const normalized = envUrl.trim().replace(/\/+$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }
  // Fallback
  return 'https://api.academiahelm.com/api';
}

/**
 * Détecte une page de challenge Cloudflare.
 */
function isCloudflareChallenge(status: number, contentType: string, body: string): boolean {
  if (status === 403 && contentType.includes('text/html')) return true;
  if (status === 403 && (body.includes('Just a moment') || body.includes('cf-challenge'))) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Effectue un fetch avec timeout et headers BFF.
 */
async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeout: number = DEFAULT_TIMEOUT,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Tente de récupérer les écoles depuis une URL donnée.
 * Retourne les données ou null en cas d'échec.
 */
async function tryFetchSchools(
  url: string,
  headers: Record<string, string>,
  timeout?: number,
): Promise<any[] | null> {
  try {
    const response = await fetchWithTimeout(url, headers, timeout);
    if (response.ok) {
      const data = await response.json();
      console.log(`[School List API] ✅ Success from ${url}: ${Array.isArray(data) ? data.length : 'unknown'} schools`);
      return Array.isArray(data) ? data : data?.schools || null;
    }
    console.warn(`[School List API] ${url} returned ${response.status}`);
    return null;
  } catch (error: any) {
    console.warn(`[School List API] ${url} failed: ${error.message}`);
    return null;
  }
}

export async function GET(_request: NextRequest) {
  const PATH = 'public/schools/list';

  // Headers BFF standard
  const bffHeaders: Record<string, string> = {
    'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js server-side)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Headers pour Railway (nécessite le Host original)
  const railwayHeaders: Record<string, string> = {
    ...bffHeaders,
    'Host': API_PUBLIC_HOST,
  };

  // ── Stratégie 1 : URL interne Railway (si API_INTERNAL_URL configuré) ──
  if (process.env.API_INTERNAL_URL) {
    const internalUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
    console.log(`[School List API] Strategy 1: Internal → ${internalUrl}`);

    const data = await tryFetchSchools(internalUrl, railwayHeaders);
    if (data) return NextResponse.json(data);

    // Fallback vers l'URL publique
    const publicUrl = `${getApiBaseUrlSync().replace(/\/$/, '')}/${PATH}`;
    console.log(`[School List API] Strategy 1 fallback: Public → ${publicUrl}`);

    const pubData = await tryFetchSchools(publicUrl, bffHeaders);
    if (pubData) return NextResponse.json(pubData);
  }

  // ── Stratégie 2 : URL publique avec détection Cloudflare + fallback Railway ──
  const publicUrl = `${getApiBaseUrlSync().replace(/\/$/, '')}/${PATH}`;
  console.log(`[School List API] Strategy 2: Public → ${publicUrl}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(publicUrl, bffHeaders);

      // Détecter le challenge Cloudflare
      const contentType = response.headers.get('content-type') || '';
      if (isCloudflareChallenge(response.status, contentType, '')) {
        const body = await response.text();
        if (isCloudflareChallenge(response.status, contentType, body)) {
          console.error('[School List API] Cloudflare challenge detected. Trying Railway fallback...');

          // Fallback Railway direct
          const railwayUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
          const data = await tryFetchSchools(railwayUrl, railwayHeaders);
          if (data) return NextResponse.json(data);

          return NextResponse.json(
            { error: 'Cloudflare challenge', message: 'Accès bloqué par Cloudflare. Le serveur API est inaccessible.' },
            { status: 502 },
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `Erreur HTTP ${response.status}: ${response.statusText}`,
        }));

        console.error(
          `[School List API] Backend error ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
          JSON.stringify(errorData).substring(0, 500),
        );

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
          console.log(`[School List API] Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        // Dernier recours : essayer Railway direct même si ce n'est pas Cloudflare
        const railwayUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
        const data = await tryFetchSchools(railwayUrl, railwayHeaders);
        if (data) return NextResponse.json(data);

        return NextResponse.json(errorData, { status: response.status });
      }

      // ✅ Succès
      const data = await response.json();
      console.log(`[School List API] ✅ Success: ${Array.isArray(data) ? data.length : 'unknown'} schools loaded`);
      return NextResponse.json(data);
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error(`[School List API] Timeout after ${DEFAULT_TIMEOUT}ms (attempt ${attempt + 1})`);

        // Timeout → essayer Railway comme dernier recours
        if (attempt === 0) {
          console.log('[School List API] Trying Railway fallback due to timeout...');
          const railwayUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
          const data = await tryFetchSchools(railwayUrl, railwayHeaders);
          if (data) return NextResponse.json(data);
        }

        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        break;
      }

      console.error(`[School List API] Network error (attempt ${attempt + 1}):`, fetchError.message);

      // Erreur réseau → essayer Railway en fallback
      if (attempt === 0) {
        console.log('[School List API] Trying Railway fallback due to network error...');
        const railwayUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
        const data = await tryFetchSchools(railwayUrl, railwayHeaders);
        if (data) return NextResponse.json(data);
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
  }

  // Toutes les tentatives ont échoué
  return NextResponse.json(
    {
      error: 'Failed to fetch schools list',
      message: 'Erreur inattendue lors de la récupération de la liste des établissements',
    },
    { status: 502 },
  );
}
