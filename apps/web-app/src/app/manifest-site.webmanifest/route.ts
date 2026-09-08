/**
 * ============================================================================
 * MANIFEST DYNAMIQUE — Site institutionnel PWA
 * ============================================================================
 *
 * GET /manifest-site.webmanifest
 *
 * Manifest du SITE INSTITUTIONNEL d'une école (servi sur son sous-domaine,
 * ex: cspeb-eveildafriqueeducation.academiahelm.com).
 * Permet d'installer le site vitrine de l'école comme une application sur
 * PC (Chrome/Edge) et mobile (Android — iOS via apple-touch-icon).
 *
 * Branding par école :
 *   - name        → nom de l'école
 *   - short_name  → acronyme de l'école
 *   - description → slogan de l'école
 *   - theme_color → couleur primaire de l'école
 *   - icons       → logo de l'école (via /pwa-icon, redimensionné)
 *
 * Domaine principal (academiahelm.com) → valeurs par défaut Academia Helm.
 *
 * NOTE : start_url et scope sont RELATIFS — résolus par rapport à l'origine
 * du manifest (le sous-domaine de l'école), donc corrects dans tous les
 * environnements sans construction d'URL absolue.
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
  // Résoudre le subdomain depuis le host
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || null;
  const subdomain = extractSchoolSubdomain(host);

  // Valeurs par défaut (domaine principal / tenant introuvable)
  let name = 'Academia Helm';
  let shortName = 'Academia Helm';
  let description = 'La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.';
  let themeColor = DEFAULT_THEME_COLOR;
  let icons = defaultManifestIcons();

  if (subdomain) {
    const branding = await resolveSchoolBranding(subdomain);
    if (branding) {
      name = branding.name;
      shortName = branding.shortName;
      description = branding.slogan || `${branding.name} — Établissement scolaire`;
      themeColor = branding.primaryColor || DEFAULT_THEME_COLOR;
      icons = schoolManifestIcons(subdomain);
    }
  }

  const manifest = {
    // ⭐ id distinct de l'app (/manifest-app.webmanifest) → les deux sont
    // installables séparément (site vitrine ET application de gestion).
    id: '/?source=pwa-site',
    name,
    short_name: shortName,
    description,
    start_url: '/?source=pwa-site',
    scope: '/',
    display: 'standalone',
    theme_color: themeColor,
    background_color: DEFAULT_BG_COLOR,
    lang: 'fr-FR',
    dir: 'ltr',
    categories: ['education'],
    icons,
    shortcuts: [
      {
        name: 'Pré-inscription',
        short_name: 'S\'inscrire',
        description: 'Formulaire de pré-inscription en ligne',
        url: '/public/pre-enrollment?source=pwa-site',
        icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Recrutement',
        short_name: 'Jobs',
        description: 'Offres d\'emploi de l\'établissement',
        url: '/jobs?source=pwa-site',
        icons: [{ src: '/web-app-manifest-192x192.png', sizes: '192x192' }],
      },
    ],
    prefer_related_applications: false,
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
