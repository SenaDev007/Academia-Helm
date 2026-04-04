/**
 * ============================================================================
 * TENANT REDIRECTION UTILITIES - ACADEMIA HUB
 * ============================================================================
 * 
 * Utilitaires pour la redirection multi-tenant sécurisée
 * Supporte : local, production (ex. academia-hub.pro)
 *
 * RÈGLES :
 * - En local : utilise les query params (pas de DNS requis)
 * - En prod : utilise les sous-domaines réels
 * - Logging automatique de toutes les redirections
 * - Protection contre les accès non autorisés
 * 
 * ============================================================================
 */

import { getAppEnvironment, getAppBaseUrl, type AppEnvironment } from './app-base-url';
import { API_URL } from '@/lib/api-config';

/**
 * Configuration de redirection tenant
 */
export interface TenantRedirectConfig {
  tenantSlug: string;
  tenantId?: string;
  path?: string;
  queryParams?: Record<string, string>;
  portalType?: 'SCHOOL' | 'TEACHER' | 'PARENT';
  skipLogging?: boolean;
}

/**
 * Résultat d'une redirection
 */
export interface TenantRedirectResult {
  url: string;
  method: 'redirect' | 'query' | 'subdomain';
  logged: boolean;
}

/**
 * Log d'une redirection (pour analytics/audit)
 */
export interface RedirectLog {
  tenantId?: string;
  tenantSlug: string;
  fromUrl: string;
  toUrl: string;
  method: 'redirect' | 'query' | 'subdomain';
  environment: AppEnvironment;
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Construit l'URL de redirection vers un tenant
 * 
 * @param config - Configuration de la redirection
 * @returns URL complète vers le tenant
 * 
 * @example
 * ```ts
 * // Local : http://localhost:3001/login?tenant=college-x&portal=school
 * getTenantRedirectUrl({ tenantSlug: 'college-x', path: '/login', portalType: 'SCHOOL' })
 * 
 * // Production : https://college-x.academia-hub.com/login?portal=school
 * getTenantRedirectUrl({ tenantSlug: 'college-x', path: '/login', portalType: 'SCHOOL' })
 * ```
 */
export function getTenantRedirectUrl(config: TenantRedirectConfig): string {
  const {
    tenantSlug,
    path = '/app',
    queryParams = {},
    portalType,
  } = config;

  const env = getAppEnvironment();
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;

  // Validation
  if (!tenantSlug || tenantSlug.trim() === '') {
    throw new Error('tenantSlug is required for tenant redirection');
  }

  // En local : utiliser les query params (pas de DNS requis)
  if (env === 'local') {
    const baseUrl = getAppBaseUrl();
    const url = new URL(path, baseUrl);

    url.searchParams.set('tenant', tenantSlug);
    if (config.tenantId) {
      url.searchParams.set('tenant_id', config.tenantId);
    }
    if (portalType) {
      url.searchParams.set('portal', portalType.toLowerCase());
    }
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  // En preview/production : utiliser le sous-domaine
  if (!baseDomain) {
    console.warn('NEXT_PUBLIC_BASE_DOMAIN not set, falling back to query params');
    // Fallback vers query params si baseDomain n'est pas défini
    const baseUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : 'https://academia-hub.com';
    const url = new URL(path, baseUrl);
    url.searchParams.set('tenant', tenantSlug);
    if (portalType) {
      url.searchParams.set('portal', portalType.toLowerCase());
    }
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  const protocol = env === 'local' ? 'http' : 'https';
  const domain = `${tenantSlug}.${baseDomain}`;
  const url = new URL(path, `${protocol}://${domain}`);

  if (config.tenantId) {
    url.searchParams.set('tenant_id', config.tenantId);
  }
  if (portalType) {
    url.searchParams.set('portal', portalType.toLowerCase());
  }
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

/**
 * Effectue une redirection vers un tenant avec logging
 * 
 * @param config - Configuration de la redirection
 * @returns Promise qui se résout après la redirection
 */
export async function redirectToTenant(config: TenantRedirectConfig): Promise<void> {
  const url = getTenantRedirectUrl(config);
  
  // Logger la redirection (sauf si skipLogging est true)
  if (!config.skipLogging) {
    await logTenantRedirect({
      tenantId: config.tenantId,
      tenantSlug: config.tenantSlug,
      fromUrl: typeof window !== 'undefined' ? window.location.href : '',
      toUrl: url,
      method: getAppEnvironment() === 'local' ? 'query' : 'subdomain',
      environment: getAppEnvironment(),
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    });
  }
  
  // Effectuer la redirection
  if (typeof window !== 'undefined') {
    window.location.href = url;
  } else {
    // Côté serveur, utiliser Next.js redirect
    const { redirect } = await import('next/navigation');
    redirect(url);
  }
}

/**
 * Log une redirection tenant (pour analytics/audit)
 * 
 * @param log - Données du log
 */
async function logTenantRedirect(log: RedirectLog): Promise<void> {
  try {
    // En production, envoyer au backend pour stockage
    if (getAppEnvironment() !== 'local') {
      await fetch(`${API_URL}/portal/redirect-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
        // Ne pas attendre la réponse pour ne pas bloquer la redirection
        keepalive: true,
      }).catch(() => {
        // Ignorer les erreurs de logging
      });
    } else {
      // En local, juste logger dans la console
      console.log('[Tenant Redirect]', {
        tenant: log.tenantSlug,
        from: log.fromUrl,
        to: log.toUrl,
        method: log.method,
      });
    }
  } catch (error) {
    // Ne pas bloquer la redirection en cas d'erreur de logging
    console.warn('Failed to log tenant redirect:', error);
  }
}

/**
 * Vérifie si une URL est une redirection tenant valide
 * 
 * @param url - URL à vérifier
 * @returns true si l'URL est une redirection tenant valide
 */
export function isValidTenantRedirect(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // En local, vérifier la présence du paramètre tenant
    if (getAppEnvironment() === 'local') {
      return urlObj.searchParams.has('tenant');
    }
    
    // En preview/prod, vérifier que c'est un sous-domaine du base domain
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (!baseDomain) {
      return false;
    }
    
    const hostname = urlObj.hostname;
    const parts = hostname.split('.');
    
    // Doit avoir au moins 2 parties (subdomain + base domain)
    if (parts.length < 2) {
      return false;
    }
    
    // Vérifier que le domaine de base correspond
    const domainParts = baseDomain.split('.');
    const hostDomainParts = parts.slice(-domainParts.length);
    return hostDomainParts.join('.') === baseDomain;
  } catch {
    return false;
  }
}

/**
 * Extrait le tenant slug d'une URL
 * 
 * @param url - URL à analyser
 * @returns Tenant slug ou null si non trouvé
 */
export function extractTenantSlugFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const env = getAppEnvironment();
    
    // En local, extraire du query param
    if (env === 'local') {
      return urlObj.searchParams.get('tenant');
    }
    
    // En preview/prod, extraire du sous-domaine
    const hostname = urlObj.hostname;
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    
    if (!baseDomain) {
      return null;
    }
    
    const parts = hostname.split('.');
    const domainParts = baseDomain.split('.');
    
    if (parts.length <= domainParts.length) {
      return null;
    }
    
    // Le sous-domaine est la première partie
    return parts[0];
  } catch {
    return null;
  }
}

/**
 * Vérifie si l'utilisateur a accès à un tenant
 * (à implémenter avec la logique métier)
 * 
 * @param tenantId - ID du tenant
 * @param userId - ID de l'utilisateur
 * @returns true si l'utilisateur a accès
 */
export async function hasTenantAccess(
  tenantId: string,
  userId?: string
): Promise<boolean> {
  if (!userId) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_URL}/auth/check-tenant-access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId, userId }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.hasAccess === true;
  } catch {
    return false;
  }
}
