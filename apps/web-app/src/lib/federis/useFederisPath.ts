/**
 * useFederisPath — Context-aware path helper for Academia Federis
 *
 * When accessed via the satellite subdomain (academiafederis.academiahelm.com),
 * navigation paths should be root-relative (e.g. /dashboard instead of /federis/dashboard)
 * to keep URLs clean and avoid double-prefix issues.
 *
 * When accessed via the main domain (academiahelm.com/federis), paths keep their
 * /federis/ prefix as usual.
 *
 * The middleware handles the rewrite:
 *   academiafederis.academiahelm.com/dashboard → /federis/dashboard
 */

'use client';

import { useMemo } from 'react';

const FEDERIS_SUBDOMAIN = 'academiafederis';

/**
 * Returns the base path for Federis routes depending on the current domain.
 * - On academiafederis.academiahelm.com → '' (root-relative)
 * - On academiahelm.com or any other domain → '/federis'
 */
export function useFederisBasePath(): string {
  return useMemo(() => {
    if (typeof window === 'undefined') return '/federis';
    const host = window.location.hostname;
    const parts = host.split('.');
    if (parts.length >= 3 && parts[0] === FEDERIS_SUBDOMAIN) {
      return '';
    }
    return '/federis';
  }, []);
}

/**
 * Returns a full Federis path with the correct prefix.
 * Example: federisPath('/dashboard') → '/federis/dashboard' or '/dashboard'
 */
export function useFederisPath() {
  const basePath = useFederisBasePath();

  const path = (subPath: string): string => {
    // subPath should be like '/dashboard', '/exams', etc.
    const clean = subPath.startsWith('/') ? subPath : `/${subPath}`;
    return `${basePath}${clean}`;
  };

  return { basePath, path };
}

/**
 * Check if currently on the Federis satellite subdomain.
 */
export function useIsFederisSubdomain(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const parts = host.split('.');
    return parts.length >= 3 && parts[0] === FEDERIS_SUBDOMAIN;
  }, []);
}

/**
 * Non-hook version of useFederisBasePath.
 * Can be used in client components that are not React function components
 * (e.g. event handlers, page-level logic).
 *
 * Returns '/federis' on SSR or when not on the satellite subdomain.
 * Returns '' on academiafederis.academiahelm.com.
 */
export function getFederisBasePath(): string {
  if (typeof window === 'undefined') return '/federis';
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length >= 3 && parts[0] === FEDERIS_SUBDOMAIN) {
    return '';
  }
  return '/federis';
}

/**
 * Non-hook version of path builder.
 * federisLink('/dashboard') → '/federis/dashboard' or '/dashboard'
 */
export function federisLink(subPath: string): string {
  const basePath = getFederisBasePath();
  const clean = subPath.startsWith('/') ? subPath : `/${subPath}`;
  return `${basePath}${clean}`;
}
