/**
 * ============================================================================
 * PWA MANIFEST BRANDING — Résolution du branding d'école pour les manifests
 * ============================================================================
 *
 * Helpers serveur partagés par les routes de manifest PWA :
 *   - /manifest-site.webmanifest  (site institutionnel de l'école)
 *   - /manifest-app.webmanifest   (application Academia Helm de l'école)
 *
 * Résolution du subdomain depuis le Host de la requête, puis branding via
 * l'API publique /tenants/by-subdomain (même priorité que
 * extractBrandingFromTenant : identityProfiles > schoolSettings > schools).
 * ============================================================================
 */

import { isReservedSubdomain } from '@/lib/tenant/constants';
import { getApiBaseUrl } from '@/lib/utils/urls';

export interface SchoolBranding {
  tenantId: string | null;
  name: string;
  shortName: string;
  slogan: string | null;
  primaryColor: string | null;
  subdomain: string;
}

/** Extrait le subdomain d'école depuis un header host (null si domaine principal / réservé). */
export function extractSchoolSubdomain(host: string | null): string | null {
  if (!host) return null;
  const parts = host.split(':')[0].split('.');

  // Localhost avec sous-domaines type school.localhost:3001
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    if (parts.length >= 2 && !isReservedSubdomain(parts[0]) && parts[0] !== 'localhost') {
      return parts[0];
    }
    return null;
  }

  if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
    return parts[0];
  }
  return null;
}

/** Tronque proprement pour un short_name de manifest (≤ 12 caractères conseillés). */
export function buildShortName(source: string, fallback: string): string {
  const clean = (source || '').trim();
  if (!clean) return fallback;
  // Si le nom est déjà court → tel quel
  if (clean.length <= 12) return clean;
  // Sinon → acronymes des mots (ex: "Complexe Scolaire Privé X" → "CSPX")
  const initials = clean
    .split(/[\s\-–—]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  if (initials.length >= 3 && initials.length <= 12) return initials;
  return clean.substring(0, 12);
}

/**
 * Résout le branding d'une école depuis son subdomain.
 * Retourne null si le tenant est introuvable (l'appelant utilisera les
 * valeurs par défaut Academia Helm).
 */
export async function resolveSchoolBranding(subdomain: string): Promise<SchoolBranding | null> {
  try {
    const apiUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${apiUrl}/tenants/by-subdomain/${encodeURIComponent(subdomain)}`,
      { signal: controller.signal, headers: { 'Cache-Control': 'no-store' } },
    );
    clearTimeout(timeoutId);
    if (!response.ok) return null;

    const data = await response.json();
    const identity = data?.identityProfiles?.[0] ?? null;
    const settings = data?.schoolSettings ?? null;
    const school = Array.isArray(data?.schools) ? data.schools[0] : data?.schools ?? null;

    const name: string =
      identity?.schoolName || settings?.schoolName || school?.name || data?.name || subdomain;

    return {
      tenantId: data?.id || null,
      name,
      shortName: buildShortName(
        identity?.schoolAcronym || school?.abbreviation || name,
        'Academia',
      ),
      slogan: identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
      primaryColor: settings?.primaryColor || school?.primaryColor || null,
      subdomain,
    };
  } catch {
    return null;
  }
}

/** Icônes d'un manifest pour une école (via la route /pwa-icon, même origine). */
export function schoolManifestIcons(subdomain: string) {
  const q = `tenant=${encodeURIComponent(subdomain)}`;
  return [
    { src: `/pwa-icon?${q}&s=192`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `/pwa-icon?${q}&s=512`, sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: `/pwa-icon?${q}&s=192&m=1`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: `/pwa-icon?${q}&s=512&m=1`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
}

/** Icônes par défaut Academia Helm (logos statiques). */
export function defaultManifestIcons() {
  return [
    { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
}
