/**
 * SEO Utilities
 *
 * URL canonique, métadonnées, JSON-LD.
 * Définir NEXT_PUBLIC_APP_URL en production (sans slash final).
 */

import type { Metadata } from 'next';
import { BRAND } from './brand';
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

/** Image Open Graph dédiée (1200×630 recommandé) — `public/images/og-academia-helm.png` */
export const DEFAULT_OG_IMAGE_PATH = '/images/og-academia-helm.png';

const defaultImage = DEFAULT_OG_IMAGE_PATH;

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
  image?: string;
  noIndex?: boolean;
}

/**
 * Génère les métadonnées SEO complètes pour une page
 */
export function generateSEOMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    path = '',
    image = defaultImage,
    noIndex = false,
  } = config;

  const siteUrl = getPublicSiteUrl();
  const pathSegment = path === '' || path.startsWith('/') ? path : `/${path}`;
  const fullTitle = title.includes(BRAND.name) ? title : `${title} | ${BRAND.name}`;
  const url = `${siteUrl}${pathSegment}`;

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
          url: image,
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
      images: [image],
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

