/**
 * ============================================================================
 * MANIFEST DYNAMIQUE — Application Academia Helm (PWA installable)
 * ============================================================================
 *
 * GET /manifest-app.webmanifest
 *
 * Manifest de l'APPLICATION de gestion (portails + /app/*), lié depuis :
 *   - /login, /portal (pages de connexion)
 *   - /app/* (application authentifiée)
 *
 * Objectif : l'application Academia Helm est installable SUR PC ET MOBILE
 * comme une application native, séparément du site institutionnel de
 * l'école (qui a son propre manifest /manifest-site.webmanifest).
 *
 * Comportement :
 *   - Sur un sous-domaine d'école : branding de l'école (nom, logo, couleur),
 *     start_url = /login (page de connexion de l'école)
 *   - Sur le domaine principal : branding Academia Helm,
 *     start_url = /portal (sélection de portails)
 *
 * Installable via :
 *   - Chrome/Edge desktop : icône dans la barre d'adresse → "Installer"
 *   - Android : bannière beforeinstallprompt (composant PWAInstallPrompt)
 *   - iOS : Partager → "Sur l'écran d'accueil" (instructions dans le
 *     composant PWAInstallPrompt)
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractSchoolSubdomain,
  resolveSchoolBranding,
  schoolManifestIcons,
  defaultManifestIcons,
} from '@/lib/pwa/manifest-branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_THEME_COLOR = '#0D1F6E';
const DEFAULT_BG_COLOR = '#ffffff';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || null;
  const subdomain = extractSchoolSubdomain(host);

  let name = 'Academia Helm';
  let shortName = 'Academia Helm';
  let description =
    'Application de gestion scolaire Academia Helm : élèves, finances, examens, RH et pilotage.';
  let themeColor = DEFAULT_THEME_COLOR;
  let icons = defaultManifestIcons();
  let startUrl = '/portal?source=pwa-app';
  let manifestId = '/portal?source=pwa-app';
  let shortcuts: Array<{
    name: string;
    short_name: string;
    description: string;
    url: string;
    icons: Array<{ src: string; sizes: string }>;
  }> = [];

  if (subdomain) {
    const branding = await resolveSchoolBranding(subdomain);
    if (branding) {
      name = `${branding.name} — Academia Helm`;
      shortName = branding.shortName;
      description = `Plateforme de gestion scolaire de ${branding.name}. ${branding.slogan || 'Connexion direction, enseignants et parents.'}`;
      themeColor = branding.primaryColor || DEFAULT_THEME_COLOR;
      icons = schoolManifestIcons(subdomain);
      startUrl = '/login?source=pwa-app';
      manifestId = '/login?source=pwa-app';
      shortcuts = [
        {
          name: 'Se connecter',
          short_name: 'Connexion',
          description: 'Page de connexion de l\'établissement',
          url: '/login?source=pwa-app',
          icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }],
        },
        {
          name: 'Site de l\'école',
          short_name: 'Site',
          description: 'Site institutionnel de l\'établissement',
          url: '/?source=pwa-app',
          icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }],
        },
      ];
    }
  }

  const manifest = {
    // ⭐ id distinct du site institutionnel (/?source=pwa-site) → deux apps
    // installables côte à côte sur le même sous-domaine.
    id: manifestId,
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    theme_color: themeColor,
    background_color: DEFAULT_BG_COLOR,
    lang: 'fr-FR',
    dir: 'ltr',
    categories: ['education', 'productivity'],
    icons,
    shortcuts,
    prefer_related_applications: false,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
