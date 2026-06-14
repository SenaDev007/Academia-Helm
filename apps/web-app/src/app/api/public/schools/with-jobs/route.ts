/**
 * ============================================================================
 * SCHOOL LIST WITH JOBS API PROXY - ÉTABLISSEMENTS AVEC OFFRES D'EMPLOI
 * ============================================================================
 *
 * Single-query endpoint for the public careers page (/jobs).
 * Returns all active schools with their published job counts in one API call,
 * replacing the old N+1 pattern (fetch schools → fetch jobs per school).
 *
 * Stratégie de résolution identique à schools/list :
 *   1. URL interne Railway si API_INTERNAL_URL configuré
 *   2. URL publique avec détection Cloudflare
 *   3. Fallback Railway direct si Cloudflare bloque
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

/** URL Railway directe — contourne Cloudflare. */
const RAILWAY_INTERNAL_ORIGIN = 'https://8nvfmrrz.up.railway.app';
const API_PUBLIC_HOST = 'api.academiahelm.com';

/** ISR: revalidate every 60 seconds — school data changes rarely. */
export const revalidate = 60;

function getApiBaseUrlSync(): string {
  if (typeof window === 'undefined' && process.env.API_INTERNAL_URL) {
    const url = process.env.API_INTERNAL_URL.trim().replace(/\/+$/, '');
    return url.endsWith('/api') ? url : `${url}/api`;
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const normalized = envUrl.trim().replace(/\/+$/, '');
    return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
  }
  return 'https://api.academiahelm.com/api';
}

function isCloudflareChallenge(status: number, contentType: string, body: string): boolean {
  if (status === 403 && contentType.includes('text/html')) return true;
  if (status === 403 && (body.includes('Just a moment') || body.includes('cf-challenge'))) return true;
  return false;
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeout: number = 15000,
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

export async function GET(_request: NextRequest) {
  const PATH = 'public/schools/with-jobs';
  const bffHeaders: Record<string, string> = {
    'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js server-side)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  const railwayHeaders: Record<string, string> = {
    ...bffHeaders,
    'Host': API_PUBLIC_HOST,
  };

  // ── Stratégie 1 : URL interne Railway ──
  if (process.env.API_INTERNAL_URL) {
    const internalUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
    console.log(`[Schools With Jobs] Strategy 1: Internal → ${internalUrl}`);

    try {
      const response = await fetchWithTimeout(internalUrl, railwayHeaders);
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      console.warn(`[Schools With Jobs] Internal returned ${response.status}, falling back`);
    } catch (error: any) {
      console.warn(`[Schools With Jobs] Internal failed: ${error.message}, falling back`);
    }

    // Fallback public
    const publicUrl = `${getApiBaseUrlSync().replace(/\/$/, '')}/${PATH}`;
    try {
      const response = await fetchWithTimeout(publicUrl, bffHeaders);
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
    } catch {
      // Continue to strategy 2
    }
  }

  // ── Stratégie 2 : URL publique ──
  const publicUrl = `${getApiBaseUrlSync().replace(/\/$/, '')}/${PATH}`;
  console.log(`[Schools With Jobs] Strategy 2: Public → ${publicUrl}`);

  try {
    const response = await fetchWithTimeout(publicUrl, bffHeaders);

    // Détecter Cloudflare
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 403) {
      const body = await response.text();
      if (isCloudflareChallenge(response.status, contentType, body)) {
        console.error('[Schools With Jobs] Cloudflare challenge detected. Trying Railway fallback...');

        // Fallback Railway
        const railwayUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
        try {
          const railwayResponse = await fetchWithTimeout(railwayUrl, railwayHeaders);
          if (railwayResponse.ok) {
            const data = await railwayResponse.json();
            return NextResponse.json(data);
          }
        } catch {}

        return NextResponse.json(
          { error: 'Cloudflare challenge', message: 'Accès bloqué par Cloudflare.' },
          { status: 502 },
        );
      }
      // Vraie erreur 403 du backend
      return NextResponse.json(
        { error: 'Forbidden', message: 'Accès refusé par le serveur API.' },
        { status: 403 },
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: `Erreur HTTP ${response.status}: ${response.statusText}`,
      }));
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    // Erreur réseau → essayer Railway
    console.error(`[Schools With Jobs] Public URL failed: ${error.message}. Trying Railway fallback...`);
    const railwayUrl = `${RAILWAY_INTERNAL_ORIGIN}/api/${PATH}`;
    try {
      const railwayResponse = await fetchWithTimeout(railwayUrl, railwayHeaders);
      if (railwayResponse.ok) {
        const data = await railwayResponse.json();
        return NextResponse.json(data);
      }
    } catch {}

    return NextResponse.json(
      { error: 'Network error', message: 'Impossible de joindre le serveur.' },
      { status: 502 },
    );
  }
}
