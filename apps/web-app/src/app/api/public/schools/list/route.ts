/**
 * ============================================================================
 * SCHOOL LIST API PROXY - LISTE COMPLÈTE DES ÉTABLISSEMENTS
 * ============================================================================
 *
 * Proxy BFF (Backend-For-Frontend) vers le endpoint NestJS /api/public/schools/list.
 * Ce endpoint est PUBLIC (@Public) — aucune authentification requise.
 *
 * Améliorations :
 *   - Retry automatique (1x) en cas d'erreur 403/502/503/504
 *   - Logging détaillé pour diagnostiquer les problèmes
 *   - Timeout configurable (15s par défaut)
 *   - Détails de l'erreur transmis au client pour le debug
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { nestControllerUrl, bffHeaders } from '@/lib/utils/api-urls';

/** Nombre max de tentatives en cas d'erreur transitoire. */
const MAX_RETRIES = 1;

/** Codes HTTP considérés comme transitoires (réessayable). */
const RETRYABLE_STATUS_CODES = new Set([403, 502, 503, 504]);

/** Délai avant retry (ms). */
const RETRY_DELAY_MS = 800;

export async function GET(_request: NextRequest) {
  const apiUrl = nestControllerUrl('public/schools/list');

  console.log('[School List API] Calling backend at:', apiUrl);

  let lastError: { status: number; data: any } | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Timeout de 15s pour éviter les cold starts interminables
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: bffHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`[School List API] Request timed out after 15s (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        lastError = {
          status: 504,
          data: {
            error: 'Backend timeout',
            message: 'Le serveur met trop de temps à répondre. Veuillez réessayer dans quelques instants.',
          },
        };
        // Retry on timeout
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
      // Retry on network error
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      break;
    }

    // Détecter la page de challenge Cloudflare (HTML au lieu de JSON)
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 403 && contentType.includes('text/html')) {
      console.error('[School List API] Cloudflare challenge detected (403 + HTML). API URL:', apiUrl);
      return NextResponse.json(
        {
          error: 'Cloudflare challenge',
          message: 'Accès bloqué par Cloudflare. Vérifiez la configuration DNS/WAF du sous-domaine api.',
        },
        { status: 502 }
      );
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

      // Retry sur les codes transitoires (403 peut être causé par un cold start,
      // un reverse proxy temporairement indisponible, ou un WAF)
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        console.log(`[School List API] Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      break;
    }

    // ✅ Succès
    const data = await response.json();
    console.log(`[School List API] Success: ${Array.isArray(data) ? data.length : 'unknown'} schools loaded`);
    return NextResponse.json(data);
  }

  // Toutes les tentatives ont échoué
  if (lastError) {
    // Enrichir le message d'erreur avec des détails pour le debug
    const enrichedError = {
      ...lastError.data,
      _debug: {
        url: apiUrl.replace(/\/\/[^/]+/, '//***'),  // Masquer le domaine pour la sécurité
        attempts: MAX_RETRIES + 1,
        hint: lastError.status === 403
          ? 'Le serveur API a refusé l\'accès. Cela peut être dû à un problème de configuration CORS, Helmet (CORP/COEP), ou un pare-feu (WAF). Vérifiez que le backend NestJS est en cours d\'exécution et que les headers Helmet sont corrects.'
          : lastError.status === 502
          ? 'Le serveur API n\'est pas joignable. Vérifiez que le backend NestJS est démarré (npm run start:dev).'
          : undefined,
      },
    };

    return NextResponse.json(enrichedError, { status: lastError.status });
  }

  // Fallback (ne devrait jamais arriver)
  return NextResponse.json(
    {
      error: 'Failed to fetch schools list',
      message: 'Erreur inattendue lors de la récupération de la liste des établissements',
    },
    { status: 500 },
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
