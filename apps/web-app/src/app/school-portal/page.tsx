/**
 * School Portal Selection Page
 *
 * Affichée lorsqu'un utilisateur accède directement à un sous-domaine d'école.
 * Présente les 4 portails disponibles dans le contexte de cette école.
 * Résout le branding de l'école (logo, nom, couleurs, slogan) côté serveur.
 *
 * STRATÉGIE DE RÉSOLUTION CÔTÉ SERVEUR :
 *   1. En local : BFF via 127.0.0.1 (self-request local = OK)
 *   2. En production : Appel direct au backend NestJS (évite le self-request Vercel
 *      qui provoque des cold starts et des timeouts ERR_TIMED_OUT)
 *   3. Fallback client : Si le serveur échoue, le composant client tente via la BFF
 */

import { headers } from 'next/headers';
import InstitutionalWebsite from '@/components/portal/InstitutionalWebsite';
import { BRAND } from '@/lib/brand';
import { isReservedSubdomain } from '@/lib/tenant/constants';
import { extractBrandingFromTenant } from '@/lib/tenant/branding';
import { getApiBaseUrl, getAppBaseUrl } from '@/lib/utils/urls';
import type { Metadata } from 'next';
import { generateSEOMetadata, detectRequestHostname } from '@/lib/seo';

/**
 * generateMetadata — génère des meta tags dynamiques basés sur le tenant.
 * Récupère la config du site institutionnel (TenantWebsite) pour :
 *   - Titre SEO personnalisé
 *   - Description SEO
 *   - Mots-clés
 *   - Open Graph image
 *   - Canonical URL
 */
export async function generateMetadata(): Promise<Metadata> {
  const hostname = await detectRequestHostname();

  // Valeurs par défaut (fallback)
  let title = `${BRAND.name} — Plateforme de pilotage éducatif`;
  let description = 'Découvrez notre établissement scolaire et accédez à nos services en ligne.';
  let keywords: string | undefined;
  let ogImageUrl: string | undefined;
  let canonicalUrl: string | undefined;

  try {
    const headersList = await headers();
    const host = headersList.get('host') || headersList.get('x-forwarded-host') || '';
    const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

    if (parts.length >= 3 && !isReservedSubdomain(parts[0])) {
      const slug = parts[0];
      const baseUrl = `https://${parts.join('.')}`;
      canonicalUrl = baseUrl;

      // Récupérer la config du site institutionnel
      const apiBaseUrl = getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(
        `${apiBaseUrl}/tenant-website/public/${encodeURIComponent(slug)}`,
        { cache: 'no-store', signal: controller.signal },
      );
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const website = data?.website;
        const schoolName = data?.website?.heroTitle || '';

        if (website?.seoMetaTitle) {
          title = website.seoMetaTitle;
        } else if (schoolName) {
          title = `${schoolName} — Établissement scolaire`;
        }

        if (website?.seoMetaDescription) {
          description = website.seoMetaDescription;
        }

        if (website?.seoKeywords) {
          keywords = website.seoKeywords;
        }

        if (website?.seoOgImageUrl) {
          ogImageUrl = website.seoOgImageUrl;
        }
      }
    }
  } catch {
    // Fallback : utiliser les valeurs par défaut
  }

  return {
    title,
    description,
    keywords: keywords ? keywords.split(',').map(k => k.trim()) : undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: title.split('—')[0]?.trim() || BRAND.name,
      ...(ogImageUrl ? { images: [{ url: ogImageUrl, width: 1200, height: 630 }] } : {}),
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function SchoolPortalPage() {
  // Tenter de résoudre les informations de l'école côté serveur
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
          // En local : BFF via 127.0.0.1 (self-request local = rapide)
          const response = await fetch(
            `http://127.0.0.1:${process.env.PORT || 3001}/api/public/schools/by-subdomain/${subdomain}`,
            { cache: 'no-store' },
          );
          if (response.ok) schoolInfo = await response.json();
        } else {
          // En production : Appel direct au backend NestJS
          // (évite le self-request Vercel qui provoque des cold starts)
          const apiBaseUrl = getApiBaseUrl(); // ex: https://api.academiahelm.com/api
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

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
        }
      } catch {
        // API indisponible — le composant client tentera aussi via la BFF
      }
    }
  } catch {
    // headers() peut échouer dans certains contextes
  }

  return <InstitutionalWebsite schoolInfo={schoolInfo} subdomain={subdomain} />;
}
