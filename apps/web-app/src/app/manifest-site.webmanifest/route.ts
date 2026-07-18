/**
 * ============================================================================
 * MANIFEST DINAMIQUE — Site institutionnel PWA
 * ============================================================================
 *
 * GET /manifest-site.webmanifest
 *
 * Retourne un manifest.json adapté au tenant courant (basé sur le subdomain).
 * Permet aux utilisateurs d'installer le site institutionnel de leur école
 * comme une PWA sur desktop ou mobile.
 *
 * Le manifeste utilise :
 *   - Le nom de l'école (tenant.name) comme `name`
 *   - Le logo du tenant comme icône (si disponible)
 *   - La couleur primaire du tenant comme `theme_color`
 *   - L'URL du sous-domaine comme `start_url` (avec `?source=pwa`)
 *   - `display: standalone` pour une expérience type app
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { isReservedSubdomain } from '@/lib/tenant/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_THEME_COLOR = '#1A3A8F';
const DEFAULT_BG_COLOR = '#ffffff';

export async function GET(request: NextRequest) {
  // Résoudre le subdomain depuis le host
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || '';
  const parts = host.split(':')[0].split('.');
  const subdomain = parts.length >= 3 && !isReservedSubdomain(parts[0]) ? parts[0] : null;

  // Valeurs par défaut (domaine principal)
  let name = 'Academia Helm';
  let shortName = 'Academia';
  let description = 'Plateforme de pilotage éducatif';
  let themeColor = DEFAULT_THEME_COLOR;
  let backgroundColor = DEFAULT_BG_COLOR;
  let logoUrl: string | null = null;

  // Si on est sur un sous-domaine d'école, récupérer le branding
  if (subdomain) {
    try {
      const apiUrl = getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${apiUrl}/tenants/by-subdomain/${subdomain}`, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-store' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const tenant = await response.json();
        name = tenant.name || name;
        shortName = (tenant.shortName || tenant.acronym || name).substring(0, 12);
        description = tenant.slogan || description;
        themeColor = tenant.themeColor || tenant.primaryColor || DEFAULT_THEME_COLOR;
        logoUrl = tenant.logoUrl || null;
      }
    } catch {
      // Fallback silencieux — utiliser les valeurs par défaut
    }
  }

  // Construire les icônes
  const icons = [];
  if (logoUrl) {
    // Logo custom du tenant — utilisation avec différents sizes (le navigateur
    // redimensionne automatiquement)
    icons.push(
      { src: logoUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    );
  } else {
    // Icônes par défaut Academia Helm
    icons.push(
      { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    );
  }

  const startUrl = subdomain
    ? `https://${parts.join('.')}/?source=pwa`
    : `https://${host}/?source=pwa`;

  const manifest = {
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope: subdomain ? `https://${parts.join('.')}/` : '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    theme_color: themeColor,
    background_color: backgroundColor,
    icons,
    categories: ['education', 'productivity'],
    lang: 'fr',
    dir: 'ltr',
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
