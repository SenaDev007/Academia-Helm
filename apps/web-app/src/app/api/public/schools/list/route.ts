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

    // ⚠️ PERFORMANCE : Timeout 15s (compromis).
    // Avant : 30s → le user attendait jusqu'à 30s avant de voir une erreur.
    // Maintenant : 15s — suffisant pour un cold start Neon (~3-5s) + transmission
    // des logos base64 (1-2MB par école). En cas de timeout, on renvoie une
    // liste VIDE (200) au lieu de 504 — l'UI affiche "Réessayer" au lieu d'un
    // spinner infini.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(normalizeApiUrl(apiUrl), {
        method: 'GET',
        headers: bffHeaders(),
        // ⭐ Cache côté Next.js BFF (60s) — AVANT : cache: 'no-store'.
        // Raison : la liste des écoles change RAREMENT (nouveau tenant = quelques
        // fois par an). 60s de cache Next.js = 1 appel backend par minute max,
        // au lieu de 1 par visite. Sur 1000 visites/heure, on passe de 1000 à 60
        // appels backend — divisé par 16. Les nouveaux tenants onboarded
        // apparaissent dans la minute suivant leur création, c'est acceptable.
        next: { revalidate: 60 },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[School List API] Request timed out after 15s');
        // Retourner une liste vide au lieu de 504 — l'UI affichera
        // un bouton "Réessayer" au lieu d'un spinner infini.
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

    // ⭐ RESTAURER les logos base64 — l'utilisateur a confirmé qu'AVANT les
    // modifications, toutes les écoles s'affichaient AVEC leur logo.
    // Le vrai problème n'était pas les logos mais le cache: 'no-store' qui
    // faisait 1 appel backend par visite → cold start Neon → 30s+ de spinner.
    // Avec next: { revalidate: 60 }, le cache Next.js sert la réponse en <100ms
    // pour toutes les visites suivantes dans la minute.

    // Forcer les headers de cache côté client aussi (60s) + stale-while-revalidate
    // pour servir instantanément la version cacheée pendant qu'on re-fetch en arrière-plan.
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
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
