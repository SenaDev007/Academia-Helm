/**
 * SEO Utilities
 *
 * URL canonique, métadonnées, JSON-LD.
 * Définir NEXT_PUBLIC_APP_URL en production (sans slash final).
 *
 * Open Graph multi-tenant :
 *   - Domaine principal (academiahelm.com, www.academiahelm.com) → OpenGraph-AcademiaHelm.png
 *   - Sous-domaines tenant (*.academiahelm.com)               → OpenGraph-AcademiaHelmTenants.png
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { BRAND } from './brand';
import { isReservedSubdomain } from './tenant/constants';
import { buildHreflangLanguages } from './seo/locales';

/**
 * Métadonnées de vérification (Google Search Console, Bing, etc.)
 * Variables optionnelles : NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION, NEXT_PUBLIC_BING_SITE_VERIFICATION, NEXT_PUBLIC_YANDEX_SITE_VERIFICATION
 */
export function buildSiteVerification(): Metadata['verification'] | undefined {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  const yandex = process.env.NEXT_PUBLIC_YANDEX_SITE_VERIFICATION?.trim();
  if (!google && !bing && !yandex) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(yandex ? { yandex } : {}),
    ...(bing ? { other: { 'msvalidate.01': bing } } : {}),
  };
}

/* ── Open Graph image paths (1200×630) ─────────────────────────────────── */

/** Image OG pour le domaine principal Academia Helm */
export const OG_IMAGE_MAIN = '/images/OpenGraph-AcademiaHelm.png';

/** Image OG pour les sous-domaines des écoles (tenants) */
export const OG_IMAGE_TENANT = '/images/OpenGraph-AcademiaHelmTenants.png';

/**
 * @deprecated Use OG_IMAGE_MAIN instead. Kept for backward compatibility.
 * Legacy WebP path — will be removed once all pages use the new PNG.
 */
export const DEFAULT_OG_IMAGE_PATH = OG_IMAGE_MAIN;

/**
 * Détermine si le hostname donné correspond au domaine principal Academia Helm.
 *
 * Domaine principal :
 *   - academiahelm.com
 *   - www.academiahelm.com
 *
 * Sous-domaine tenant :
 *   - cspeb-eveildafriqueeducation.academiahelm.com
 *   - mon-ecole.academiahelm.com
 *   - www.cspeb-eveildafriqueeducation.academiahelm.com
 *
 * @returns true si domaine principal, false si sous-domaine tenant
 */
export function isMainDomain(hostname: string): boolean {
  const base = hostname.split(':')[0]; // strip port
  const parts = base.split('.');

  // Cas : academiahelm.com (2 parties) → domaine principal
  if (parts.length <= 2) return true;

  // Cas : www.academiahelm.com (3 parties, subdomain = www)
  if (parts.length === 3) {
    const subdomain = parts[0];
    // www ou autre sous-domaine réservé → domaine principal
    if (isReservedSubdomain(subdomain)) return true;
    // Sous-domaine non réservé → tenant
    return false;
  }

  // Cas : www.cspeb-eveil.academiahelm.com (4+ parties)
  // Le premier segment est soit www soit le subdomain tenant
  const firstPart = parts[0];
  if (firstPart === 'www') {
    // www.cspeb-eveil.academiahelm.com → le subdomain réel est parts[1]
    // Mais ce format n'est pas standard, on considère comme tenant
    return isReservedSubdomain(parts[1]);
  }
  // cspeb-eveil.academiahelm.com → tenant
  return isReservedSubdomain(firstPart);
}

/**
 * Extrait le sous-domaine tenant du hostname.
 * Retourne null si c'est le domaine principal.
 */
export function extractTenantSubdomainFromHost(hostname: string): string | null {
  if (isMainDomain(hostname)) return null;
  const base = hostname.split(':')[0];
  const parts = base.split('.');
  if (parts[0] === 'www') return parts[1] || null;
  return parts[0];
}

/**
 * Retourne le chemin relatif de l'image OG à utiliser selon le hostname.
 */
export function getOGImagePath(hostname?: string): string {
  if (!hostname) return OG_IMAGE_MAIN;
  return isMainDomain(hostname) ? OG_IMAGE_MAIN : OG_IMAGE_TENANT;
}

/**
 * Construit l'URL absolue de l'image OG à partir du domaine courant.
 * Les crawlers (Facebook, WhatsApp, Twitter, etc.) nécessitent des URLs absolues.
 */
export function buildAbsoluteOGImageUrl(hostname?: string): string {
  const base = hostname
    ? `https://${hostname.split(':')[0]}`
    : getPublicSiteUrl();
  const path = getOGImagePath(hostname);
  return `${base}${path}`;
}

/**
 * Détecte le hostname de la requête courante (côté serveur uniquement).
 * Utilise next/headers — doit être appelé dans un Server Component ou generateMetadata.
 */
export async function detectRequestHostname(): Promise<string> {
  try {
    const headersList = await headers();
    return headersList.get('host') || headersList.get('x-forwarded-host') || 'academiahelm.com';
  } catch {
    // Fallback si appelé hors du contexte de requête (build time)
    return 'academiahelm.com';
  }
}

const defaultImage = OG_IMAGE_MAIN;

/**
 * URL publique absolue du site (build & runtime serveur).
 */
export function getPublicSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_BASE_DOMAIN
      ? `https://${process.env.NEXT_PUBLIC_BASE_DOMAIN.replace(/^https?:\/\//, '')}`
      : '');

  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || '3001';
    return `http://localhost:${port}`.replace(/\/+$/, '');
  }
  return 'https://academiahelm.com';
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords?: string[];
  path?: string;
  /** Image OG — chemin relatif (ex: /images/...) ou URL absolue. Auto-détecté si omis. */
  image?: string;
  /** Hostname courant — si fourni, détermine automatiquement l'image OG (principal vs tenant) */
  hostname?: string;
  noIndex?: boolean;
}

/**
 * Génère les métadonnées SEO complètes pour une page.
 *
 * Si `hostname` est fourni, l'image OG est sélectionnée automatiquement :
 *   - Domaine principal → OpenGraph-AcademiaHelm.png
 *   - Sous-domaine tenant → OpenGraph-AcademiaHelmTenants.png
 *
 * Les URLs d'images OG sont toujours absolues (requis par Facebook, WhatsApp, etc.).
 */
export function generateSEOMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    path = '',
    image,
    hostname,
    noIndex = false,
  } = config;

  // Résolution de l'image OG : explicite > auto-détection > défaut
  const ogImageRelative = image || getOGImagePath(hostname);
  const ogImageAbsolute = buildAbsoluteOGImageUrl(hostname);

  // URL de la page
  const siteUrl = getPublicSiteUrl();
  const pathSegment = path === '' || path.startsWith('/') ? path : `/${path}`;
  const fullTitle = title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;
  const url = hostname
    ? `https://${hostname.split(':')[0]}${pathSegment}`
    : `${siteUrl}${pathSegment}`;

  return {
    title: fullTitle,
    description,
    keywords: [
      'pilotage éducatif',
      'logiciel école',
      'plateforme éducation',
      BRAND.name,
      ...keywords,
    ],
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: BRAND.name,
      images: [
        {
          url: ogImageAbsolute,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImageAbsolute],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    alternates: {
      canonical: url,
      languages: buildHreflangLanguages(siteUrl, pathSegment),
    },
  };
}

/**
 * Génère le JSON-LD structured data pour une organisation
 */
export function generateOrganizationSchema() {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url: siteUrl,
    logo: `${siteUrl}${BRAND.logoPath}`,
    description: BRAND.description,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'BJ',
      addressRegion: 'Afrique de l\'Ouest',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Support',
      email: 'support@academiahub.com',
    },
    sameAs: [
      'https://facebook.com/academiahub',
      'https://linkedin.com/company/academiahub',
      'https://twitter.com/academiahub',
      'https://youtube.com/@academiahub',
    ],
  };
}

/**
 * JSON-LD WebSite (page d'accueil / domaine)
 */
export function generateWebSiteSchema() {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND.name,
    url: siteUrl,
    description: `${BRAND.description}. ${BRAND.slogan}`,
    inLanguage: 'fr-FR',
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}${BRAND.logoPath}`,
      },
    },
  };
}

/**
 * JSON-LD SoftwareApplication (sans note agrégée fictive — conformité Google)
 */
export function generateSoftwareApplicationSchema() {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: BRAND.name,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: siteUrl,
    description: `${BRAND.description}. ${BRAND.slogan}`,
  };
}

/**
 * JSON-LD Product (SaaS) — utile pour enrichir la compréhension du produit.
 */
export function generateProductSchema() {
  const siteUrl = getPublicSiteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Academia Helm',
    description: `${BRAND.description}. ${BRAND.slogan}`,
    brand: {
      '@type': 'Brand',
      name: BRAND.name,
    },
    image: [`${siteUrl}${DEFAULT_OG_IMAGE_PATH}`],
    url: siteUrl,
    category: 'EducationalApplication',
    offers: [
      {
        '@type': 'Offer',
        name: 'HELM SEED — 1 à 150 élèves',
        url: 'https://academiahelm.com/tarification',
        priceCurrency: 'XOF',
        availability: 'https://schema.org/InStock',
        priceSpecification: [
          {
            '@type': 'UnitPriceSpecification',
            name: 'Souscription initiale SEED',
            price: '75000',
            priceCurrency: 'XOF',
            priceType: 'https://schema.org/InvoicePrice',
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement mensuel SEED',
            price: '14900',
            priceCurrency: 'XOF',
            unitCode: 'MON',
            billingDuration: 1,
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement annuel SEED',
            price: '149000',
            priceCurrency: 'XOF',
            unitCode: 'ANN',
            billingDuration: 12,
            description: '2 mois offerts',
          },
        ],
      },
      {
        '@type': 'Offer',
        name: 'HELM GROW — 151 à 400 élèves',
        url: 'https://academiahelm.com/tarification',
        priceCurrency: 'XOF',
        availability: 'https://schema.org/InStock',
        priceSpecification: [
          {
            '@type': 'UnitPriceSpecification',
            name: 'Souscription initiale GROW',
            price: '100000',
            priceCurrency: 'XOF',
            priceType: 'https://schema.org/InvoicePrice',
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement mensuel GROW',
            price: '24900',
            priceCurrency: 'XOF',
            unitCode: 'MON',
            billingDuration: 1,
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement annuel GROW',
            price: '249000',
            priceCurrency: 'XOF',
            unitCode: 'ANN',
            billingDuration: 12,
            description: '2 mois offerts',
          },
        ],
      },
      {
        '@type': 'Offer',
        name: 'HELM LEAD — 401 à 800 élèves',
        url: 'https://academiahelm.com/tarification',
        priceCurrency: 'XOF',
        availability: 'https://schema.org/InStock',
        priceSpecification: [
          {
            '@type': 'UnitPriceSpecification',
            name: 'Souscription initiale LEAD',
            price: '150000',
            priceCurrency: 'XOF',
            priceType: 'https://schema.org/InvoicePrice',
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement mensuel LEAD',
            price: '39900',
            priceCurrency: 'XOF',
            unitCode: 'MON',
            billingDuration: 1,
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement annuel LEAD',
            price: '399000',
            priceCurrency: 'XOF',
            unitCode: 'ANN',
            billingDuration: 12,
            description: '2 mois offerts',
          },
        ],
      },
      {
        '@type': 'Offer',
        name: 'HELM NETWORK — Multi-campus',
        url: 'https://academiahelm.com/contact',
        priceCurrency: 'XOF',
        availability: 'https://schema.org/InStock',
        priceSpecification: [
          {
            '@type': 'UnitPriceSpecification',
            name: 'Souscription initiale NETWORK',
            price: '200000',
            priceCurrency: 'XOF',
            priceType: 'https://schema.org/InvoicePrice',
          },
          {
            '@type': 'UnitPriceSpecification',
            name: 'Abonnement NETWORK',
            description: 'Sur devis — tarif négocié selon le nombre de campus',
            priceCurrency: 'XOF',
            priceType: 'https://schema.org/MinimumAdvertisedPrice',
          },
        ],
      },
    ],
  };
}

