/**
 * ============================================================================
 * TENANT PORTAL SELECTION PAGE — /portal du tenant
 * ============================================================================
 *
 * Page portail du tenant (etablissement.academiahelm.com/portal).
 * Reprend le design de /portal (academiahelm.com/portal) mais adapté au tenant :
 *   - 4 boutons : École (Direction, admin), Enseignant (Pédagogie),
 *     Parent/Élève (Suivi), Public (Pré-inscription)
 *   - Chaque bouton renvoie vers /login?portal=SCHOOL|TEACHER|PARENT|PUBLIC
 *     &tenant=<slug>&school_name=<name>
 *
 * Résolution serveur du branding de l'école depuis le sous-domaine
 * (même logique que /school-portal/page.tsx).
 * ============================================================================
 */

import { headers } from 'next/headers';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import TenantPortalSelection from '@/components/portal/TenantPortalSelection';
import { PWAInstallPrompt } from '@/components/pwa/PWAInstallPrompt';
import { BRAND } from '@/lib/brand';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { extractBrandingFromTenant } from '@/lib/tenant/branding';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/utils/urls';

export async function generateMetadata(): Promise<Metadata> {
  let title = `${BRAND.name} — Portail`;
  let description = 'Accédez à votre espace : École, Enseignant, Parent/Élève ou Public.';

  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

    if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
      const slug = parts[0];
      const apiBaseUrl = getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(
          `${apiBaseUrl}/tenants/by-subdomain/${encodeURIComponent(slug)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const schoolName = data?.name || data?.schoolName || 'Établissement';
          title = `Portail — ${schoolName}`;
          description = `Accédez à votre espace ${schoolName} : École, Enseignant, Parent/Élève ou Public.`;
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }
  } catch {
    // Fallback
  }

  return {
    title,
    description,
    // ⭐ PWA — cette page est l'entrée de L'APPLICATION de l'école :
    // manifest de l'app (branding école, start_url /login), distinct du
    // manifest du site institutionnel (racine du sous-domaine).
    manifest: '/manifest-app.webmanifest',
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: BRAND.name,
    },
  };
}

export default async function TenantPortalPage() {
  let schoolInfo = null;
  let subdomain = null;

  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

    if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
      subdomain = parts[0];

      try {
        const appBaseUrl = getAppBaseUrl();
        const isLocal = appBaseUrl.includes('localhost') || appBaseUrl.includes('127.0.0.1');

        if (isLocal) {
          // Local : BFF via 127.0.0.1
          const response = await fetch(
            `http://127.0.0.1:${process.env.PORT || 3001}/api/public/schools/by-subdomain/${subdomain}`,
            { cache: 'no-store' },
          );
          if (response.ok) schoolInfo = await response.json();
        } else {
          // Production : Appel direct au backend NestJS
          const apiBaseUrl = getApiBaseUrl();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          try {
            const response = await fetch(
              `${apiBaseUrl}/tenants/by-subdomain/${encodeURIComponent(subdomain)}`,
              {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                signal: controller.signal,
              },
            );
            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();
              schoolInfo = extractBrandingFromTenant(data, subdomain);
            }
          } catch {
            clearTimeout(timeoutId);
          }
        }
      } catch {
        // API indisponible — le composant client tentera aussi via la BFF
      }
    }
  } catch {
    // headers() peut échouer dans certains contextes
  }

  return (
    <>
      <TenantPortalSelection schoolInfo={schoolInfo} subdomain={subdomain} />
      {/* ⭐ PWA — bannière d'installation de l'application de l'école */}
      <PWAInstallPrompt appName={schoolInfo?.name || 'Academia Helm'} />
    </>
  );
}
