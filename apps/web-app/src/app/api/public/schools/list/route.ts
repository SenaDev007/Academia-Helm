/**
 * ============================================================================
 * SCHOOL LIST API PROXY - LISTE COMPLÈTE DES ÉTABLISSEMENTS
 * ============================================================================
 *
 * Proxy BFF (Backend-For-Frontend) vers le endpoint NestJS /api/public/schools/list.
 * Ce endpoint est PUBLIC (@Public) — aucune authentification requise.
 *
 * Utilise `bffFetch()` qui gère automatiquement :
 *   - Le contournement de Cloudflare via API_INTERNAL_URL
 *   - Le fallback URL interne → URL publique
 *   - Les headers BFF (User-Agent, Accept)
 *   - Le timeout
 *   - La détection de challenge Cloudflare
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { bffFetch } from '@/lib/utils/api-urls';

export async function GET(_request: NextRequest) {
  try {
    const response = await bffFetch('public/schools/list', {
      method: 'GET',
      timeout: 15000,
    });

    // Détecter le challenge Cloudflare (bffFetch retourne 502 dans ce cas)
    if (response.status === 502) {
      const errorData = await response.json().catch(() => null);
      console.error('[School List API] 502 error:', JSON.stringify(errorData));

      return NextResponse.json(
        {
          error: 'Cloudflare challenge',
          message: 'Accès bloqué par Cloudflare. Configurez API_INTERNAL_URL dans Vercel pour contourner le proxy.',
          _debug: {
            hint: 'Ajoutez la variable d\'environnement API_INTERNAL_URL=https://8nvfmrrz.up.railway.app dans les paramètres Vercel du projet web-app.',
          },
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erreur HTTP ${response.status}: ${response.statusText}`,
      }));

      console.error(
        `[School List API] Backend error ${response.status}:`,
        JSON.stringify(errorData).substring(0, 500),
      );

      const hint = response.status === 403
        ? 'Le serveur API a refusé l\'accès. Cela peut être dû à Cloudflare ou à un problème de configuration.'
        : response.status === 502
        ? 'Le serveur API n\'est pas joignable. Vérifiez que le backend NestJS est démarré.'
        : undefined;

      return NextResponse.json(
        {
          ...errorData,
          _debug: hint ? { hint } : undefined,
        },
        { status: response.status },
      );
    }

    // ✅ Succès
    const data = await response.json();
    console.log(`[School List API] Success: ${Array.isArray(data) ? data.length : 'unknown'} schools loaded`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[School List API] Fetch error:', error.message);

    if (error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'Backend timeout',
          message: 'Le serveur met trop de temps à répondre. Veuillez réessayer dans quelques instants.',
        },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error: 'Network error',
        message: `Impossible de joindre le serveur: ${error.message}`,
      },
      { status: 502 },
    );
  }
}
