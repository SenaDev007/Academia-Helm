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
import { isReservedSubdomain } from '@/lib/tenant/constants';

/**
 * Configuration de redirection tenant
 */
export interface TenantRedirectConfig {
  tenantSlug: string;
  tenantId?: string;
  path?: string;
  queryParams?: Record<string, string>;
  portalType?: 'PLATFORM' | 'SCHOOL' | 'TEACHER' | 'PARENT' | 'PUBLIC';
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
 * Stratégie :
 *   - En local : toujours query params (pas de wildcard DNS en local)
 *   - En production/preview/test :
 *     - Si NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS=true → sous-domaine (ex: school.academiahelm.com)
 *     - Sinon → query params sur le domaine principal (academiahelm.com?tenant=school)
 *
 * Le mode "query params" en production est plus robuste quand le wildcard DNS
 * *.academiahelm.com n'est pas configuré. Le middleware résout quand même le
 * tenant via le paramètre ?tenant= ou ?tenant_id=.
 *
 * @param config - Configuration de la redirection
 * @returns URL complète vers le tenant
 *
 * @example
 * ```ts
 * // Local : http://localhost:3001/login?tenant=college-x&portal=school
 * // Prod avec wildcard : https://college-x.academiahelm.com/login?portal=school
 * // Prod sans wildcard : https://academiahelm.com/login?tenant=college-x&portal=school
 * getTenantRedirectUrl({ tenantSlug: 'college-x', path: '/login', portalType: 'SCHOOL' })
 * ```
 */
export function getTenantRedirectUrl(config: TenantRedirectConfig): string {
  const {
    tenantSlug,
    tenantId,
    path = '/app',
    queryParams = {},
    portalType,
  } = config;

  const env = getAppEnvironment();
  let baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;

  // Nettoyage : enlever http://, https:// et les slashs de fin si le dev l'a mal configuré
  if (baseDomain) {
    baseDomain = baseDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  // Validation
  if (!tenantSlug || tenantSlug.trim() === '') {
    throw new Error('tenantSlug is required for tenant redirection');
  }

  // Détection intelligente du domaine de base si non défini
  if (!baseDomain && typeof window !== 'undefined') {
    const host = window.location.host;
    if (host.includes('academiahelm.com')) {
      baseDomain = 'academiahelm.com';
    }
  }

  // ── Helper : construit l'URL avec query params sur le domaine courant ──
  const buildQueryUrl = (baseUrl: string): string => {
    const url = new URL(path, baseUrl);
    url.searchParams.set('tenant', tenantSlug);
    if (tenantId) {
      url.searchParams.set('tenant_id', tenantId);
    }
    if (portalType) {
      url.searchParams.set('portal', portalType.toLowerCase());
    }
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  };

  // ── Helper : construit l'URL avec sous-domaine ──
  const buildSubdomainUrl = (): string => {
    const protocol = env === 'local' && baseDomain?.includes('localhost') ? 'http' : 'https';
    let domain = `${tenantSlug}.${baseDomain}`;
    if (domain.startsWith('www.')) domain = domain.substring(4);
    const url = new URL(path, `${protocol}://${domain}`);
    if (portalType) {
      url.searchParams.set('portal', portalType.toLowerCase());
    }
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  };

  // En local : utiliser les query params par défaut,
  // SAUF si l'utilisateur a configuré un domaine de base autre que localhost
  if (env === 'local') {
    const isLocalhostOnly = !baseDomain || baseDomain.includes('localhost') || baseDomain.includes('127.0.0.1');

    if (isLocalhostOnly) {
      const baseUrl = getAppBaseUrl();
      return buildQueryUrl(baseUrl);
    }
    // Sinon on laisse couler vers la logique de sous-domaine (ex: school.localhost)
  }

  // ── En production/preview/test : décider entre sous-domaine et query params ──
  //
  // IMPORTANT : Si NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS n'est pas explicitement "true",
  // on utilise les query params sur le domaine principal. C'est plus robuste :
  //   - Pas besoin de wildcard DNS *.academiahelm.com
  //   - Pas besoin de configurer chaque sous-domaine dans Vercel
  //   - Le middleware résout quand même le tenant via ?tenant=
  //
  // Pour activer le mode sous-domaine (multi-tenant strict par sous-domaine) :
  //   NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS=true
  //
  const useSubdomain = process.env.NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS === 'true';

  if (!useSubdomain) {
    // Mode query params — utiliser le domaine principal ou le domaine courant
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : baseDomain
          ? `https://${baseDomain}`
          : 'https://academiahelm.com';
    return buildQueryUrl(baseUrl);
  }

  // Mode sous-domaine activé — vérifier qu'on a un baseDomain
  if (!baseDomain) {
    console.warn(
      'NEXT_PUBLIC_USE_SUBDOMAIN_TENANTS=true mais NEXT_PUBLIC_BASE_DOMAIN non défini — fallback sur query params',
    );
    const baseUrl =
      typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : 'https://academiahelm.com';
    return buildQueryUrl(baseUrl);
  }

  return buildSubdomainUrl();
}

/**
 * Effectue une redirection vers un tenant avec logging
 * 
 * @param config - Configuration de la redirection
 * @returns Promise qui se résout après la redirection
 */
export async function redirectToTenant(config: TenantRedirectConfig): Promise<void> {
  const url = getTenantRedirectUrl(config);
  
  // Logger la redirection en arrière-plan (fire-and-forget)
  // ⚠️ On n'attend PAS le logging pour ne pas bloquer la redirection.
  // Le logging est un best-effort : si le backend est en cold start,
  // on ne veut pas que l'utilisateur attende 30+ secondes.
  if (!config.skipLogging) {
    logTenantRedirect({
      tenantId: config.tenantId,
      tenantSlug: config.tenantSlug,
      fromUrl: typeof window !== 'undefined' ? window.location.href : '',
      toUrl: url,
      method: getAppEnvironment() === 'local' ? 'query' : 'subdomain',
      environment: getAppEnvironment(),
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    }).catch(() => {
      // Silently ignore logging errors
    });
  }
  
  // Effectuer la redirection immédiatement
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
      // ⚠️ Timeout de 5s maximum pour éviter de bloquer quoi que ce soit
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch(`${API_URL}/portal/redirect-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
        keepalive: true,
        signal: controller.signal,
      }).catch(() => {
        // Ignorer les erreurs de logging
      }).finally(() => {
        clearTimeout(timeoutId);
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
    const subdomain = parts[0];
    // Ne pas retourner les sous-domaines réservés (www, api, admin, etc.)
    if (isReservedSubdomain(subdomain)) {
      return null;
    }
    return subdomain;
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
