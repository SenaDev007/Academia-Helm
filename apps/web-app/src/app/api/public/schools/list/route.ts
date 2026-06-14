/**
 * ============================================================================
 * SCHOOL LIST API PROXY - LISTE COMPLÈTE DES ÉTABLISSEMENTS
 * ============================================================================
 *
 * Proxy BFF (Backend-For-Frontend) vers le endpoint NestJS /api/public/schools/list.
 * Ce endpoint est PUBLIC (@Public) — aucune authentification requise.
 *
 * Utilise le même pattern que /with-jobs (ISR cache + normalizeApiUrl + bffHeaders)
 * pour résilience face aux cold starts Neon DB et au blocage Cloudflare.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes, normalizeApiUrl, bffHeaders } from '@/lib/utils/api-urls';

/** ISR: revalidate every 60 seconds — school data changes rarely. */
export const revalidate = 60;

export async function GET(_request: NextRequest) {
  try {
    const API_BASE_URL = getApiBaseUrlForRoutes();
    const apiUrl = API_BASE_URL.endsWith('/api')
      ? `${API_BASE_URL}/public/schools/list`
      : `${API_BASE_URL}/api/public/schools/list`;

    console.log('[School List API] Calling backend at:', apiUrl);

    // Timeout de 30s pour accommoder les cold starts Neon DB
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch(normalizeApiUrl(apiUrl), {
        method: 'GET',
        headers: bffHeaders(),
        next: { revalidate: 60 },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[School List API] Request timed out after 30s');
        return NextResponse.json(
          {
            error: 'Backend timeout',
            message: 'Le serveur met trop de temps à répondre. Veuillez réessayer dans quelques instants.'
          },
          { status: 504 }
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
    return NextResponse.json(data);
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
