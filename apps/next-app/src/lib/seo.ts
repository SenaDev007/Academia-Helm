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

