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