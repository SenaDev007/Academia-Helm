/**
 * ============================================================================
 * URL HELPER - GESTION CENTRALISÉE DES URLs
 * ============================================================================
 *
 * Helper centralisé pour gérer toutes les URLs de l'application.
 * Supporte : local, production (ex. academia-hub.pro sur OVH).
 *
 * ============================================================================
 */

export type { AppEnvironment } from './app-base-url';
export { getAppEnvironment, getAppBaseUrl, isNextProductionBuild } from './app-base-url';
import { getAppEnvironment, getAppBaseUrl, isNextProductionBuild } from './app-base-url';
// Import statique (Turbopack ne supporte pas require() dynamique)
import { getTenantRedirectUrl as _getTenantRedirectUrl } from './tenant-redirect';

/**
 * Assure une URL de base pointant vers le préfixe global Nest `/api`.
 * Accepte `https://api.example.com` ou `https://api.example.com/api`.
 */
export function normalizeToNestApiRoot(url: string): string {
  const u = url.trim().replace(/\/+$/, '');
  if (u.endsWith('/api')) return u;
  return `${u}/api`;
}

/** Origine Nest en local pour les appels serveur → serveur (évite la boucle proxy Next). */
function getLocalNestApiRootFallback(): string {
  const port = process.env.API_PORT || '3000';
  return `http://127.0.0.1:${port}/api`;
}

/**
 * True si l’URL API pointe vers le même hôte:port que le front Next en local
 * (ex. NEXT_PUBLIC_API_URL=http://localhost:3001 alors que Next écoute sur 3001).
 * Dans ce cas, fetch depuis une route API Next réappelle Next → timeout.
 */
function localNestApiConflictsWithNextWeb(nestApiRoot: string): boolean {
  if (getAppEnvironment() !== 'local') return false;
  try {
    const app = new URL(getAppBaseUrl());
    const apiOriginStr = nestApiRoot.replace(/\/api\/?$/, '');
    const api = new URL(apiOriginStr);
    const loopback = (h: string) =>
      h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
    const normHost = (h: string) => (loopback(h) ? '__loopback__' : h);
    const appPort = app.port || (app.protocol === 'https:' ? '443' : '80');
    const apiPort = api.port || (api.protocol === 'https:' ? '443' : '80');
    return normHost(app.hostname) === normHost(api.hostname) && appPort === apiPort;
  } catch {
    return false;
  }
}

/**
 * Récupère l'URL de base de l'API
 * 
 * ⚠️ IMPORTANT : Ne jamais utiliser localhost en dur
 * Utilise uniquement les variables d'environnement
 * 
 * @returns URL de l'API (ex: https://api.academia-hub.com/api)
 * @throws Error si NEXT_PUBLIC_API_URL n'est pas défini en production
 */
export function getApiBaseUrl(): string {
  // PRIORITÉ 1 : Variable d'environnement explicite (TOUJOURS UTILISÉE SI DÉFINIE)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const normalized = normalizeToNestApiRoot(envUrl);
    if (localNestApiConflictsWithNextWeb(normalized)) {
      return getLocalNestApiRootFallback();
    }
    return normalized;
  }

  if (isNextProductionBuild()) {
    const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
    if (apiDomain) {
      const cleanDomain = apiDomain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}/api`;
    }
    return 'https://api.academiahelm.com/api';
  }

  const env = getAppEnvironment();
  
  if (env === 'production' || env === 'preview' || env === 'test') {
    const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
    if (apiDomain) {
      const cleanDomain = apiDomain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}/api`;
    }
    
    // Sinon, essayer de construire à partir du domaine de l'app
    if (typeof window !== 'undefined') {
      const host = window.location.host;
      if (host.includes('academiahelm.com')) {
        return 'https://api.academiahelm.com/api';
      }
    }

    return 'https://api.academiahelm.com/api';
  }
  
  // PRIORITÉ 3 : Local uniquement (fallback pour développement)
  if (env === 'local') {
    // En local, essayer de détecter depuis window si disponible
    if (typeof window !== 'undefined') {
      // Si on est sur le même port, utiliser /api
      const currentHost = window.location.host;
      return `${window.location.protocol}//${currentHost}/api`;
    }
    
    const port = process.env.API_PORT || '3000';
    return `http://127.0.0.1:${port}/api`;
  }
  
  // Ne devrait jamais arriver ici
  throw new Error(
    'Unable to determine API base URL. Please set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_API_DOMAIN.'
  );
}

/**
 * Récupère le domaine de base (sans protocole)
 * 
 * ⚠️ IMPORTANT : Ne jamais utiliser localhost en dur
 * Utilise uniquement les variables d'environnement
 * 
 * @returns Domaine de base (ex: academiahelm.com)
 * @throws Error si NEXT_PUBLIC_BASE_DOMAIN n'est pas défini en production
 */
export function getBaseDomain(): string {
  // PRIORITÉ 1 : Variable d'environnement explicite
  let baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  
  // Détection intelligente si non défini
  if (!baseDomain && typeof window !== 'undefined') {
    const host = window.location.host;
    if (host.includes('academiahelm.com')) {
      baseDomain = 'academiahelm.com';
    }
  }

  if (baseDomain) {
    // Retirer le protocole si présent
    return baseDomain.replace(/^https?:\/\//, '');
  }

  if (isNextProductionBuild()) {
    return 'next-build.invalid';
  }

  const env = getAppEnvironment();
  
  if (env === 'production' || env === 'preview' || env === 'test') {
    if (typeof window !== 'undefined') return window.location.host;
    
    // Fallback vers le nouveau domaine
    return 'academiahelm.com';
  }

  if (env === 'local') {
    if (typeof window !== 'undefined') {
      return window.location.host;
    }
    
    // Dernier recours : utiliser le port par défaut Next.js
    // ⚠️ Ceci est un fallback de développement uniquement
    const port = process.env.PORT || '3001';
    return `localhost:${port}`;
  }
  
  // Ne devrait jamais arriver ici
  throw new Error(
    'Unable to determine base domain. Please set NEXT_PUBLIC_BASE_DOMAIN.'
  );
}

/**
 * Construit l'URL de redirection vers un tenant (sous-domaine)
 * 
 * @deprecated Utiliser getTenantRedirectUrl de tenant-redirect.ts à la place
 * Cette fonction est conservée pour compatibilité ascendante
 * 
 * @param tenantSlug - Slug du tenant (ex: "college-x")
 * @param path - Chemin optionnel (ex: "/login")
 * @param queryParams - Paramètres de requête optionnels
 * @returns URL complète vers le sous-domaine
 */
export function getTenantRedirectUrl(
  tenantSlug: string,
  path: string = '/app',
  queryParams?: Record<string, string>
): string {
  // Utiliser la nouvelle implémentation
  return _getTenantRedirectUrl({
    tenantSlug,
    path,
    queryParams,
  });
}

/**
 * Construit l'URL complète à partir d'un chemin relatif
 * 
 * @param path - Chemin relatif (ex: "/login")
 * @returns URL complète
 */
export function getFullUrl(path: string): string {
  const baseUrl = getAppBaseUrl();
  return new URL(path, baseUrl).toString();
}

/**
 * Construit l'URL de l'API à partir d'un chemin relatif
 * 
 * @param path - Chemin relatif (ex: "/auth/login")
 * @returns URL complète de l'API
 */
export function getApiUrl(path: string): string {
  const apiBaseUrl = getApiBaseUrl();
  // S'assurer que le chemin commence par /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, apiBaseUrl).toString();
}
