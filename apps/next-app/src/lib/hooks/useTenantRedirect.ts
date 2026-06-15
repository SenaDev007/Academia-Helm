/**
 * ============================================================================
 * USE TENANT REDIRECT HOOK - ACADEMIA HUB
 * ============================================================================
 * 
 * Hook React pour gérer les redirections tenant de manière sécurisée
 * 
 * ============================================================================
 */

import { useCallback } from 'react';
import { redirectToTenant, getTenantRedirectUrl, type TenantRedirectConfig } from '@/lib/utils/tenant-redirect';

/**
 * Hook pour gérer les redirections tenant
 * 
 * @returns Fonction de redirection et helpers
 * 
 * @example
 * ```tsx
 * const { redirectToTenant, getRedirectUrl } = useTenantRedirect();
 * 
 * const handleSchoolSelect = (school: School) => {
 *   redirectToTenant({
 *     tenantSlug: school.slug,
 *     tenantId: school.id,
 *     path: '/login',
 *     portalType: 'SCHOOL'
 *   });
 * };
 * ```
 */
export function useTenantRedirect() {
  /**
   * Redirige vers un tenant avec logging automatique
   */
  const redirect = useCallback(async (config: TenantRedirectConfig) => {
    await redirectToTenant(config);
  }, []);

  /**
   * Obtient l'URL de redirection sans rediriger
   * Utile pour les liens ou les vérifications
   */
  const getUrl = useCallback((config: TenantRedirectConfig): string => {
    return getTenantRedirectUrl(config);
  }, []);

  return {
    redirectToTenant: redirect,
    getTenantRedirectUrl: getUrl,
  };
}
