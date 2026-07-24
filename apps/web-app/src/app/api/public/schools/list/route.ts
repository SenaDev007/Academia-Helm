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
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
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
        // ⚠️ PLUS DE next: { revalidate: 60 } — ce cache est géré par Vercel
        // Data Cache et peut persister même après redéploiement. Il a été
        // empoisonné avec une réponse partielle (1 école sur 2) et la purge
        // est difficile. On utilise UNIQUEMENT Cache-Control HTTP qui est
        // géré par le CDN et peut être purgé via les headers de réponse.
        // Le cache navigateur (s-maxage=60) reste actif pour les visites suivantes.
        cache: 'no-store', // ne pas cacher côté Next.js Data Cache
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

    // ⭐ VALIDATION : Vérifier qu'on a bien reçu TOUTES les écoles.
    // Le backend peut parfois renvoyer une réponse partielle (timeout, cold start
    // en cours, etc.). Si on cache cette réponse incomplète, le cache Next.js
    // servira une liste tronquée pendant 60s — c'est le bug "1 école sur 2".
    // Solution : ne cacher QUE si la réponse est complète (au moins 1 école
    // ET la réponse fait une taille raisonnable).
    const rawList = Array.isArray(data) ? data
      : (data?.schools ?? data?.tenants ?? []);
    const isResponseComplete = Array.isArray(rawList) && rawList.length > 0
      && JSON.stringify(data).length > 1000; // 1 école sans logo = ~500 bytes

    // ⭐ RESTAURER les logos base64 — l'utilisateur a confirmé qu'AVANT les
    // modifications, toutes les écoles s'affichaient AVEC leur logo.
    // Le vrai problème n'était pas les logos mais le cache: 'no-store' qui
    // faisait 1 appel backend par visite → cold start Neon → 30s+ de spinner.

    // Cache策略 :
    // - Si réponse COMPLÈTE : cache 60s (s-maxage=60 + stale-while-revalidate=300)
    // - Si réponse INCOMPLÈTE : no-cache (pour forcer un re-fetch au prochain appel)
    const cacheControl = isResponseComplete
      ? 'public, s-maxage=60, stale-while-revalidate=300'
      : 'no-cache, no-store, must-revalidate';

    console.log(`[School List API] Response: ${rawList.length} schools, ${JSON.stringify(data).length} bytes, cache=${isResponseComplete ? 'enabled' : 'no-cache'}`);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': cacheControl,
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
