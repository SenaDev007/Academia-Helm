/**
 * ============================================================================
 * SCHOOL LIST API PROXY - LISTE COMPLÈTE DES ÉTABLISSEMENTS
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export async function GET(_request: NextRequest) {
  try {
    const API_BASE_URL = getApiBaseUrlForRoutes();
    const apiUrl = API_BASE_URL.endsWith('/api') 
      ? `${API_BASE_URL}/public/schools/list`
      : `${API_BASE_URL}/public/schools/list`;
    
    console.log('[School List API] Calling backend at:', apiUrl);
    
    // Timeout de 8s pour éviter les cold starts interminables
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('[School List API] Request timed out after 8s');
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
