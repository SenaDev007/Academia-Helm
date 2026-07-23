/**
 * ============================================================================
 * SCHOOL LIST API PROXY - LISTE COMPLÈTE DES ÉTABLISSEMENTS
 * ============================================================================
 *
 * Proxy BFF (Backend-For-Frontend) vers le endpoint NestJS /api/public/schools/list.
 * Ce endpoint est PUBLIC (@Public) — aucune authentification requise.
 *
 * ⚠️ BUILD : force-dynamic pour éviter que Vercel ne timeout pendant le build
 * statique (le backend peut être lent à répondre à cause des cold starts Neon).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

// Force dynamic — ne jamais essayer de pré-render cette route au build
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const API_BASE_URL = getApiBaseUrlForRoutes();
    const apiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/public/schools/list`
      : `${API_BASE_URL}/api/public/schools/list`;

    // ⚠️ PERFORMANCE : Timeout réduit de 30s à 8s.
    // Raison : le bouton "Portail" pouvait rester bloqué jusqu'à 30s + fallback
    // 10s côté client = 45s de spinner. Sur mobile c'était insupportable.
    // 8s est suffisant pour un cold start Neon (~3-5s) + marge.
    // En cas de timeout, on renvoie une liste VIDE (200) au lieu de 504
    // — l'UI affiche "Aucune école trouvée" au lieu d'un spinner infini.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let response;
    try {
      response = await fetch(normalizeApiUrl(apiUrl), {
        method: 'GET',
        headers: bffHeaders(),
        // ⭐ Cache court côté Next.js BFF (10s) en PLUS du cache Redis backend (60s).
        // Avant : cache: 'no-store' → chaque visite du /portal faisait un appel
        // backend complet. Sur 1000 visites/heure, c'était 1000 appels DB.
        // Maintenant : 360 appels/heure max (1 toutes les 10s) — divisé par 28.
        // Les nouveaux tenants onboarded apparaissent dans les 10s suivant leur création,
        // c'est acceptable pour un listage portail public.
        next: { revalidate: 10 },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[School List API] Request timed out after 8s');
        // ⚠️ Retourner une liste vide au lieu de 504 — l'UI affichera
        // "Aucune école trouvée" au lieu d'un spinner infini.
        return NextResponse.json(
          { schools: [], tenants: [], error: 'timeout', message: 'Délai dépassé' },
          { status: 200 }
        );
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erreur HTTP ${response.status}: ${response.statusText}`,
      }));
      console.error('[School List API] Backend error:', errorData);
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    // ⚠️ Forcer les headers de cache côté client aussi (10s) pour éviter
    // que le navigateur ne refasse la même requête immédiatement.
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    console.error('[School List API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch schools list',
        message: error.message || 'Erreur lors de la récupération de la liste des établissements'
      },
      { status: 500 }
    );
  }
}
