/**
 * ============================================================================
 * API URL HELPER - ROUTES API NEXT.JS
 * ============================================================================
 * 
 * Helper pour obtenir l'URL de l'API dans les routes API Next.js
 * Utilise le helper centralisé getApiBaseUrl()
 * 
 * ⚠️ IMPORTANT : Ne jamais utiliser localhost en dur
 * 
 * ============================================================================
 */

import { getApiBaseUrl } from './urls';

/**
 * Récupère l'URL de base de l'API pour les routes API Next.js
 * 
 * Cette fonction est optimisée pour être utilisée dans les routes API
 * où process.env est disponible mais window ne l'est pas.
 * 
 * @returns URL de base de l'API (ex: https://api.academiahelm.com/api)
 */
export function getApiBaseUrlForRoutes(): string {
  // Utiliser le helper centralisé
  return getApiBaseUrl();
}

/**
 * URL vers un contrôleur Nest déclaré avec `@Controller('...')`.
 * Avec `setGlobalPrefix('api')`, la route effective est `/api/...`.
 * `getApiBaseUrl()` se termine déjà par `/api` — on ajoute simplement le chemin du contrôleur.
 */
export function nestControllerUrl(path: string): string {
  const base = getApiBaseUrlForRoutes().replace(/\/$/, '');
  const p = path.replace(/^\//, '');
  return `${base}/${p}`;
}

/**
 * @deprecated Use `nestControllerUrl` instead.
 * Previously, NestJS controllers had `@Controller('api/...')`, creating a double `/api/api/...` prefix.
 * Controllers now use `@Controller('...')` without the `api/` prefix, so use `nestControllerUrl`.
 */
export function nestDoublePrefixedControllerUrl(path: string): string {
  return nestControllerUrl(path);
}

/**
 * Construit une URL API complète à partir d'un chemin
 * 
 * @param path - Chemin relatif (ex: "/auth/login")
 * @returns URL complète de l'API
 */
export function getApiUrlForRoutes(path: string): string {
  const baseUrl = getApiBaseUrlForRoutes();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl).toString();
}

/**
 * Normalise une URL pour utiliser 127.0.0.1 au lieu de localhost
 * Évite les erreurs EACCES dans les routes API Next.js (côté serveur)
 * 
 * @param url - URL à normaliser
 * @returns URL normalisée avec 127.0.0.1
 */
export function normalizeApiUrl(url: string): string {
  // Remplacer localhost par 127.0.0.1 pour éviter les problèmes DNS/IPv6/EACCES
  return url.replace(/http:\/\/localhost:/g, 'http://127.0.0.1:');
}

/**
 * Headers HTTP à envoyer dans les appels BFF (serveur-à-serveur).
 *
 * Cloudflare Managed Challenge bloque les requêtes sans User-Agent
 * (renvoie 403 + page HTML "Just a moment..."). L'ajout d'un User-Agent
 * explicite et de Accept: application/json permet à Cloudflare de
 * classer la requête comme légitime et de la laisser passer.
 *
 * @param extraHeaders - Headers additionnels à fusionner (ex: Authorization)
 * @returns Headers prêts pour fetch()
 */
export function bffHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js server-side)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

/**
 * URL interne pour contourner Cloudflare (côté serveur uniquement).
 *
 * Si `API_INTERNAL_URL` est défini (variable d'environnement serveur, non NEXT_PUBLIC_),
 * les appels BFF l'utiliseront en priorité pour contourner le proxy Cloudflare
 * qui bloque souvent les requêtes venant de Vercel.
 *
 * Format attendu : https://xxx.up.railway.app (sans /api final)
 * Le Host header original sera envoyé pour que Railway route correctement.
 */
function getInternalApiBaseUrl(): string | null {
  if (typeof window !== 'undefined') return null; // Côté serveur uniquement
  const url = process.env.API_INTERNAL_URL;
  if (!url) return null;
  return url.replace(/\/+$/, '');
}

/**
 * URL publique de l'API (celle qui passe par Cloudflare).
 * Utilisée comme fallback si API_INTERNAL_URL n'est pas défini.
 */
function getPublicApiOrigin(): string {
  const base = getApiBaseUrl(); // ex: https://api.academiahelm.com/api
  // Extraire l'origine sans le /api
  try {
    const url = new URL(base);
    return url.origin; // ex: https://api.academiahelm.com
  } catch {
    return 'https://api.academiahelm.com';
  }
}

/**
 * Détecte si une réponse est une page de challenge Cloudflare.
 * Cloudflare Managed Challenge renvoie 403 + Content-Type: text/html
 * avec un body contenant "Just a moment" ou "cf-challenge".
 */
function isCloudflareChallenge(response: Response, body: string): boolean {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 403 && contentType.includes('text/html')) {
    return true;
  }
  // Double vérification : 403 + body HTML contenant des marqueurs Cloudflare
  if (response.status === 403 && (body.includes('Just a moment') || body.includes('cf-challenge') || body.includes('cf-browser-metadata'))) {
    return true;
  }
  return false;
}

/**
 * ==========================================================================
 * bffFetch — Fetch BFF avec fallback automatique Cloudflare
 * ==========================================================================
 *
 * Fonction centralisée pour les appels BFF (serveur-à-serveur).
 *
 * Comportement :
 *   1. Si `API_INTERNAL_URL` est défini → appel direct via Railway (contourne Cloudflare)
 *   2. Sinon → appel via l'URL publique (Cloudflare)
 *      - Si Cloudflare bloque (403 + HTML), tentative de fallback via l'URL interne
 *        si `API_INTERNAL_URL` est disponible (non défini dans ce cas, mais on
 *        pourrait l'ajouter dynamiquement)
 *
 * Avantages :
 *   - Un seul point d'entrée pour tous les appels BFF
 *   - Gestion automatique du blocage Cloudflare
 *   - Logging détaillé pour le diagnostic
 *   - Timeout configurable
 *
 * @param path - Chemin API (ex: 'public/schools/list')
 * @param options - Options fetch (method, headers, body, etc.)
 * @returns Response du backend
 */
export async function bffFetch(
  path: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 15000, ...fetchOptions } = options;
  const internalBase = getInternalApiBaseUrl();
  const publicOrigin = getPublicApiOrigin();

  // Construire les headers avec User-Agent et Host
  const baseHeaders: Record<string, string> = {
    'User-Agent': 'AcademiaHelm-BFF/1.0 (Next.js server-side)',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  // Fusionner les headers personnalisés
  const customHeaders = fetchOptions.headers
    ? Object.fromEntries(
        fetchOptions.headers instanceof Headers
          ? fetchOptions.headers.entries()
          : Array.isArray(fetchOptions.headers)
            ? fetchOptions.headers
            : Object.entries(fetchOptions.headers as Record<string, string>),
      )
    : {};

  const mergedHeaders: Record<string, string> = { ...baseHeaders, ...customHeaders };

  // Si API_INTERNAL_URL est défini, l'utiliser directement (contourne Cloudflare)
  if (internalBase) {
    const internalUrl = `${internalBase}/api/${path.replace(/^\//, '')}`;
    // Envoyer le Host original pour que Railway route correctement
    mergedHeaders['Host'] = new URL(publicOrigin).host;
    console.log(`[BFF] Using internal URL: ${internalUrl} (Host: ${mergedHeaders['Host']})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(internalUrl, {
        ...fetchOptions,
        headers: mergedHeaders,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[BFF] Internal URL failed: ${error.message}, falling back to public URL`);
      // Fallback vers l'URL publique
      delete mergedHeaders['Host']; // Pas besoin de Host pour l'URL publique
      const publicUrl = nestControllerUrl(path);
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), timeout);
      try {
        const fallbackResponse = await fetch(publicUrl, {
          ...fetchOptions,
          headers: mergedHeaders,
          signal: fallbackController.signal,
        });
        clearTimeout(fallbackTimeout);
        return fallbackResponse;
      } catch {
        clearTimeout(fallbackTimeout);
        throw error; // Lever l'erreur originale
      }
    }
  }

  // Pas d'URL interne → appel via l'URL publique (Cloudflare)
  const publicUrl = nestControllerUrl(path);
  console.log(`[BFF] Using public URL: ${publicUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(publicUrl, {
      ...fetchOptions,
      headers: mergedHeaders,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Vérifier si Cloudflare bloque
    if (response.status === 403) {
      const body = await response.text();
      if (isCloudflareChallenge(response, body)) {
        console.error(`[BFF] Cloudflare challenge detected on public URL. API_INTERNAL_URL is not configured.`);
        // Retourner une réponse d'erreur structurée
        return new Response(
          JSON.stringify({
            error: 'Cloudflare challenge',
            message: 'Accès bloqué par Cloudflare. Configurez API_INTERNAL_URL dans Vercel pour contourner.',
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      // Ce n'est pas Cloudflare, c'est une vraie erreur 403 du backend
      return new Response(body, {
        status: 403,
        headers: response.headers,
      });
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    throw error;
  }
}