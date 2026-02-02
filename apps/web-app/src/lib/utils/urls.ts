/**
 * ============================================================================
 * URL HELPER - GESTION CENTRALISÉE DES URLs
 * ============================================================================
 * 
 * Helper centralisé pour gérer toutes les URLs de l'application
 * Supporte : local, preview (Vercel), production
 * 
 * ============================================================================
 */

/**
 * Environnement actuel
 */
export type AppEnvironment = 'local' | 'preview' | 'production';

/**
 * Détecte l'environnement actuel
 */
export function getAppEnvironment(): AppEnvironment {
  // En production, vérifier si on est sur Vercel preview ou production
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'local';
    }
    
    // Vercel preview (contient .vercel.app)
    if (hostname.includes('.vercel.app')) {
      return 'preview';
    }
    
    // Production (domaine custom)
    return 'production';
  }
  
  // Côté serveur, utiliser les variables d'environnement
  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;
  
  if (env === 'development' || !env) {
    return 'local';
  }
  
  if (process.env.VERCEL_ENV === 'preview') {
    return 'preview';
  }
  
  return 'production';
}

/**
 * Récupère l'URL de base de l'application
 * 
 * ⚠️ IMPORTANT : Ne jamais utiliser localhost en dur
 * Utilise uniquement les variables d'environnement
 * 
 * @returns URL de base (ex: https://academia-hub.com)
 * @throws Error si NEXT_PUBLIC_APP_URL n'est pas défini en production
 */
export function getAppBaseUrl(): string {
  // PRIORITÉ 1 : Variable d'environnement explicite (TOUJOURS UTILISÉE SI DÉFINIE)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) {
    return envUrl;
  }
  
  const env = getAppEnvironment();
  
  // PRIORITÉ 2 : En preview/production, construire depuis le domaine
  if (env === 'preview' || env === 'production') {
    // En preview Vercel, utiliser l'URL fournie par Vercel
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    
    // Côté serveur, utiliser VERCEL_URL si disponible
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    
    // Sinon, construire depuis NEXT_PUBLIC_BASE_DOMAIN
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (baseDomain) {
      // Si le domaine contient déjà le protocole, le retirer
      const cleanDomain = baseDomain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}`;
    }
    
    // En production sans config, erreur explicite
    if (env === 'production') {
      throw new Error(
        'NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_DOMAIN must be set in production. ' +
        'Please configure your environment variables.'
      );
    }
  }
  
  // PRIORITÉ 3 : Local uniquement (fallback pour développement)
  // ⚠️ Ce fallback ne devrait jamais être utilisé si NEXT_PUBLIC_APP_URL est configuré
  if (env === 'local') {
    // En local, essayer de détecter depuis window si disponible
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}`;
    }
    
    // Dernier recours : utiliser le port par défaut Next.js
    // ⚠️ Ceci est un fallback de développement uniquement
    const port = process.env.PORT || '3001';
    return `http://localhost:${port}`;
  }
  
  // Ne devrait jamais arriver ici
  throw new Error(
    'Unable to determine app base URL. Please set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_BASE_DOMAIN.'
  );
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
    return envUrl;
  }
  
  const env = getAppEnvironment();
  
  // PRIORITÉ 2 : En preview/production, construire depuis le domaine
  if (env === 'preview' || env === 'production') {
    // Si l'API est sur un sous-domaine différent
    const apiDomain = process.env.NEXT_PUBLIC_API_DOMAIN;
    if (apiDomain) {
      const cleanDomain = apiDomain.replace(/^https?:\/\//, '');
      return `https://${cleanDomain}/api`;
    }
    
    // Sinon, utiliser le même domaine que l'app
    const appUrl = getAppBaseUrl();
    return `${appUrl}/api`;
  }
  
  // PRIORITÉ 3 : Local uniquement (fallback pour développement)
  // ⚠️ Ce fallback ne devrait jamais être utilisé si NEXT_PUBLIC_API_URL est configuré
  if (env === 'local') {
    // En local, essayer de détecter depuis window si disponible
    if (typeof window !== 'undefined') {
      // Si on est sur le même port, utiliser /api
      const currentHost = window.location.host;
      return `${window.location.protocol}//${currentHost}/api`;
    }
    
    // Dernier recours : utiliser le port par défaut API
    // ⚠️ Ceci est un fallback de développement uniquement
    // Utiliser 127.0.0.1 au lieu de localhost pour éviter les problèmes DNS/IPv6
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
 * @returns Domaine de base (ex: academia-hub.com)
 * @throws Error si NEXT_PUBLIC_BASE_DOMAIN n'est pas défini en production
 */
export function getBaseDomain(): string {
  // PRIORITÉ 1 : Variable d'environnement explicite
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
  if (baseDomain) {
    // Retirer le protocole si présent
    return baseDomain.replace(/^https?:\/\//, '');
  }
  
  const env = getAppEnvironment();
  
  // PRIORITÉ 2 : En preview/production, extraire depuis l'URL actuelle
  if (env === 'preview' || env === 'production') {
    if (typeof window !== 'undefined') {
      return window.location.host;
    }
    
    // Côté serveur, utiliser VERCEL_URL si disponible
    if (process.env.VERCEL_URL) {
      return process.env.VERCEL_URL;
    }
    
    // En production sans config, erreur explicite
    if (env === 'production') {
      throw new Error(
        'NEXT_PUBLIC_BASE_DOMAIN must be set in production. ' +
        'Please configure your environment variables.'
      );
    }
  }
  
  // PRIORITÉ 3 : Local uniquement (fallback pour développement)
  // ⚠️ Ce fallback ne devrait jamais être utilisé si NEXT_PUBLIC_BASE_DOMAIN est configuré
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
  const { getTenantRedirectUrl: newGetTenantRedirectUrl } = require('./tenant-redirect');
  return newGetTenantRedirectUrl({
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
