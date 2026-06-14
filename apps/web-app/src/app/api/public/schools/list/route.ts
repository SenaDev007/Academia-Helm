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
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

/** Nombre max de tentatives en cas d'erreur transitoire. */
const MAX_RETRIES = 1;

/** Codes HTTP considérés comme transitoires (réessayable). */
const RETRYABLE_STATUS_CODES = new Set([403, 502, 503, 504]);

/** Délai avant retry (ms). */
const RETRY_DELAY_MS = 800;

/** Timeout par défaut (ms). */
const DEFAULT_TIMEOUT = 15000;

/**
 * URL Railway directe — contourne Cloudflare.
 * Format : https://<railway-app>.up.railway.app
 * Nécessite le header Host pour que Railway route correctement.
 */
const RAILWAY_INTERNAL_ORIGIN = 'https://8nvfmrrz.up.railway.app';

/** Host original de l'API (pour le header Host envoyé à Railway). */
const API_PUBLIC_HOST = 'api.academiahelm.com';

/**
 * Construit l'URL API complète en fonction de la stratégie.
 */
function buildApiUrl(path: string, useInternal: boolean): string {
  const cleanPath = path.replace(/^\//, '');
  if (useInternal) {
    return `${RAILWAY_INTERNAL_ORIGIN}/api/${cleanPath}`;
  }
  // URL publique — getApiBaseUrl() inclut déjà /api
  const base = getApiBaseUrlSync().replace(/\/$/, '');
  return `${base}/${cleanPath}`;
}

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
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function GET(_request: NextRequest) {
  const apiInternalUrl = process.env.API_INTERNAL_URL;
  const useInternalFirst = !!apiInternalUrl;

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

  let lastError: { status: number; data: any } | null = null;

  // ── Stratégie 1 : URL interne Railway (si API_INTERNAL_URL configuré) ──
  if (useInternalFirst) {
    const internalUrl = buildApiUrl('public/schools/list', true);
    console.log(`[School List API] Strategy 1: Internal URL → ${internalUrl}`);

    try {
      const response = await fetchWithTimeout(internalUrl, railwayHeaders);

      if (response.ok) {
        const data = await response.json();
        console.log(`[School List API] ✅ Success via internal URL: ${Array.isArray(data) ? data.length : 'unknown'} schools`);
        return NextResponse.json(data);
      }

      // Erreur non-Cloudflare depuis Railway → retry ou fallback
      console.warn(`[School List API] Internal URL returned ${response.status}, falling back to public URL`);
    } catch (error: any) {
      console.warn(`[School List API] Internal URL failed: ${error.message}, falling back to public URL`);
    }

    // Fallback vers l'URL publique
    const publicUrl = buildApiUrl('public/schools/list', false);
    console.log(`[School List API] Fallback: Public URL → ${publicUrl}`);

    try {
      const response = await fetchWithTimeout(publicUrl, bffHeaders);
      if (response.ok) {
        const data = await response.json();
        console.log(`[School List API] ✅ Success via public URL (fallback): ${Array.isArray(data) ? data.length : 'unknown'} schools`);
        return NextResponse.json(data);
      }
      // Même le public a échoué — on continue vers la stratégie 2
    } catch {
      // Le public a aussi échoué — on continue
    }
  }

  // ── Stratégie 2 : URL publique avec détection Cloudflare + fallback Railway ──
  const publicUrl = buildApiUrl('public/schools/list', false);
  console.log(`[School List API] Strategy 2: Public URL → ${publicUrl}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(publicUrl, bffHeaders);

      // Détecter le challenge Cloudflare
      const contentType = response.headers.get('content-type') || '';
      if (isCloudflareChallenge(response.status, contentType, '')) {
        // Lire le body pour confirmation
        const body = await response.text();
        if (isCloudflareChallenge(response.status, contentType, body)) {
          console.error('[School List API] Cloudflare challenge detected on public URL. Trying Railway fallback...');

          // ── Fallback Railway direct ──
          const railwayUrl = buildApiUrl('public/schools/list', true);
          console.log(`[School List API] Railway fallback → ${railwayUrl}`);

          try {
            const railwayResponse = await fetchWithTimeout(railwayUrl, railwayHeaders);
            if (railwayResponse.ok) {
              const data = await railwayResponse.json();
              console.log(`[School List API] ✅ Success via Railway fallback: ${Array.isArray(data) ? data.length : 'unknown'} schools`);
              return NextResponse.json(data);
            }
            console.error(`[School List API] Railway fallback also failed: ${railwayResponse.status}`);
          } catch (railwayError: any) {
            console.error(`[School List API] Railway fallback error: ${railwayError.message}`);
          }

          // Ni public ni Railway n'ont fonctionné
          return NextResponse.json(
            {
              error: 'Cloudflare challenge',
              message: 'Accès bloqué par Cloudflare. Le serveur API est inaccessible.',
            },
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

        lastError = { status: response.status, data: errorData };

        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
          console.log(`[School List API] Retrying in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        break;
      }

      // ✅ Succès
      const data = await response.json();
      console.log(`[School List API] ✅ Success: ${Array.isArray(data) ? data.length : 'unknown'} schools loaded`);
      return NextResponse.json(data);
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error(`[School List API] Timeout after ${DEFAULT_TIMEOUT}ms (attempt ${attempt + 1})`);
        lastError = {
          status: 504,
          data: {
            error: 'Backend timeout',
            message: 'Le serveur met trop de temps à répondre.',
          },
        };
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        break;
      }

      console.error(`[School List API] Network error (attempt ${attempt + 1}):`, fetchError.message);
      lastError = {
        status: 502,
        data: {
          error: 'Network error',
          message: `Impossible de joindre le serveur: ${fetchError.message}`,
        },
      };

      // Essayer Railway en fallback si erreur réseau
      if (attempt === 0) {
        console.log('[School List API] Trying Railway fallback due to network error...');
        const railwayUrl = buildApiUrl('public/schools/list', true);
        try {
          const railwayResponse = await fetchWithTimeout(railwayUrl, railwayHeaders);
          if (railwayResponse.ok) {
            const data = await railwayResponse.json();
            console.log(`[School List API] ✅ Railway fallback success: ${Array.isArray(data) ? data.length : 'unknown'} schools`);
            return NextResponse.json(data);
          }
        } catch {
          // Railway aussi a échoué
        }
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }
  }

  // Toutes les tentatives ont échoué
  if (lastError) {
    return NextResponse.json(lastError.data, { status: lastError.status });
  }

  return NextResponse.json(
    {
      error: 'Failed to fetch schools list',
      message: 'Erreur inattendue lors de la récupération de la liste des établissements',
    },
    { status: 500 },
  );
}
